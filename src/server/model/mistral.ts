import { getConfig } from "../config";
import { logger } from "../observability/logger";
import {
  ChatModelProvider,
  ChatOptions,
  ChatStreamChunk,
  ProviderHealthStatus,
  LLMProviderType,
  MistralAuthenticationError,
  MistralRateLimitError,
  MistralTimeoutError,
  MistralAPIError,
} from "./types";

interface MistralStreamDelta {
  role?: string;
  content?: string;
}

interface MistralStreamChoice {
  index: number;
  delta: MistralStreamDelta;
  finish_reason: string | null;
}

interface MistralStreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: MistralStreamChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface MistralModelListResponse {
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

export class MistralProvider implements ChatModelProvider {
  readonly providerType: LLMProviderType = "mistral";
  private apiKey?: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(apiKey?: string, baseUrl?: string, defaultModel?: string) {
    const config = getConfig();
    this.apiKey = apiKey || config.MISTRAL_API_KEY;
    this.baseUrl = (baseUrl || config.MISTRAL_BASE_URL).replace(/\/$/, "");
    this.defaultModel = defaultModel || config.MISTRAL_MODEL;
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    if (!this.apiKey) {
      return {
        healthy: false,
        latencyMs: 0,
        error: "MISTRAL_API_KEY is not configured.",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            healthy: false,
            latencyMs: Date.now() - start,
            error: "Invalid or unauthorized Mistral API key (HTTP 401/403).",
          };
        }
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: `Mistral API returned HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as MistralModelListResponse;
      const models = data.data?.map((m) => m.id) || [];

      return {
        healthy: true,
        latencyMs: Date.now() - start,
        installedModels: models,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : "Unknown connection error";
      return {
        healthy: false,
        latencyMs,
        error: message,
      };
    }
  }

  async checkModelAvailability(modelName: string): Promise<boolean> {
    const health = await this.checkHealth();
    if (!health.healthy) {
      return false;
    }
    if (!health.installedModels || health.installedModels.length === 0) {
      return true; // Assume available if health check passed
    }

    const target = modelName.toLowerCase();
    return health.installedModels.some((m) => m.toLowerCase() === target);
  }

  async *streamChat(options: ChatOptions): AsyncIterable<ChatStreamChunk> {
    if (!this.apiKey) {
      throw new MistralAuthenticationError("MISTRAL_API_KEY is not configured.");
    }

    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    logger.debug("Initiating Mistral chat stream", {
      model,
      url,
      messageCount: options.messages.length,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: options.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
          temperature: options.temperature,
        }),
        signal: options.abortSignal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new MistralTimeoutError("Mistral request was aborted or timed out.");
      }
      logger.error("Failed to connect to Mistral API", {
        url,
        error: String(err),
      });
      throw new MistralAPIError(`Failed to connect to Mistral API: ${String(err)}`, 503, err);
    }

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
        // ignore read error
      }

      logger.error("Mistral API returned error status", {
        status: response.status,
        model,
        extra: { errorBody },
      });

      if (response.status === 401 || response.status === 403) {
        throw new MistralAuthenticationError(
          `Mistral API authentication failed: ${errorBody || response.statusText}`
        );
      }
      if (response.status === 429) {
        throw new MistralRateLimitError(
          `Mistral API rate limit or quota reached: ${errorBody || response.statusText}`
        );
      }
      if (response.status === 504 || response.status === 408) {
        throw new MistralTimeoutError(
          `Mistral API request timed out: ${errorBody || response.statusText}`
        );
      }

      throw new MistralAPIError(
        `Mistral API error (${response.status}): ${errorBody || response.statusText}`,
        response.status
      );
    }

    if (!response.body) {
      throw new MistralAPIError("Mistral response body is null", 500);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let totalTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) {
            continue;
          }

          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === "[DONE]") {
            yield { text: "", done: true, totalTokens };
            return;
          }

          try {
            const parsed = JSON.parse(jsonStr) as MistralStreamChunk;
            if (parsed.usage?.total_tokens) {
              totalTokens = parsed.usage.total_tokens;
            }

            const deltaText = parsed.choices?.[0]?.delta?.content;
            if (deltaText) {
              yield {
                text: deltaText,
                done: false,
                totalTokens,
              };
            }
          } catch {
            // Ignore malformed intermediate JSON lines
          }
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data:")) {
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr !== "[DONE]") {
            try {
              const parsed = JSON.parse(jsonStr) as MistralStreamChunk;
              if (parsed.usage?.total_tokens) {
                totalTokens = parsed.usage.total_tokens;
              }
              const deltaText = parsed.choices?.[0]?.delta?.content;
              if (deltaText) {
                yield { text: deltaText, done: false, totalTokens };
              }
            } catch {
              // ignore
            }
          }
        }
      }

      yield { text: "", done: true, totalTokens };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new MistralTimeoutError("Mistral stream reading was aborted.");
      }
      throw err;
    } finally {
      reader.releaseLock();
    }
  }
}
