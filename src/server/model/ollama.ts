import { getConfig } from "../config";
import { logger } from "../observability/logger";
import {
  ChatModelProvider,
  ChatOptions,
  ChatStreamChunk,
  OllamaHealthStatus,
  LLMProviderType,
  OllamaUnavailableError,
  ModelNotFoundError,
  OllamaGenerationError,
  OllamaTimeoutError,
} from "./types";

interface OllamaChatResponseChunk {
  model?: string;
  created_at?: string;
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  total_duration?: number;
  eval_count?: number;
  error?: string;
}

interface OllamaTagResponse {
  models: Array<{
    name: string;
    model: string;
    size: number;
  }>;
}

export class OllamaProvider implements ChatModelProvider {
  readonly providerType: LLMProviderType = "ollama";
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl?: string, defaultModel?: string) {
    const config = getConfig();
    this.baseUrl = (baseUrl || config.OLLAMA_BASE_URL).replace(/\/$/, "");
    this.defaultModel = defaultModel || config.OLLAMA_MODEL;
  }

  async checkHealth(): Promise<OllamaHealthStatus> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: `Ollama returned HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = (await response.json()) as OllamaTagResponse;
      const models = data.models?.map((m) => m.name) || [];

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
    if (!health.healthy || !health.installedModels) {
      return false;
    }

    const target = modelName.toLowerCase();
    return health.installedModels.some(
      (m) => m.toLowerCase() === target || m.toLowerCase().startsWith(`${target}:`)
    );
  }

  async *streamChat(options: ChatOptions): AsyncIterable<ChatStreamChunk> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;

    logger.debug("Initiating Ollama chat stream", {
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
        },
        body: JSON.stringify({
          model,
          messages: options.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
          options: {
            temperature: options.temperature ?? 0.7,
          },
        }),
        signal: options.abortSignal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        logger.info("Ollama request aborted by client");
        throw err;
      }
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new OllamaTimeoutError();
      }
      logger.error("Failed to connect to Ollama", { error: String(err), url });
      throw new OllamaUnavailableError(
        `Unable to reach local Ollama inference service at ${this.baseUrl}. Check that Ollama is running.`
      );
    }

    if (!response.ok) {
      const status = response.status;
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
        errorBody = response.statusText;
      }

      logger.error("Ollama API returned error", { status, errorBody, model });

      if (status === 404 || errorBody.toLowerCase().includes("model") && errorBody.toLowerCase().includes("not found")) {
        throw new ModelNotFoundError(model);
      }

      if (status >= 500) {
        throw new OllamaUnavailableError(`Ollama server error (HTTP ${status}): ${errorBody}`);
      }

      throw new OllamaGenerationError(`Ollama inference error (HTTP ${status}): ${errorBody}`);
    }

    if (!response.body) {
      throw new OllamaGenerationError("Ollama response body is empty.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let chunk: OllamaChatResponseChunk;
          try {
            chunk = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (chunk.error) {
            if (chunk.error.toLowerCase().includes("not found")) {
              throw new ModelNotFoundError(model);
            }
            throw new OllamaGenerationError(chunk.error);
          }

          if (chunk.message?.content) {
            yield {
              text: chunk.message.content,
              done: chunk.done,
              totalTokens: chunk.eval_count,
            };
          }

          if (chunk.done) {
            yield {
              text: "",
              done: true,
              totalTokens: chunk.eval_count,
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export { getModelProvider, setModelProvider } from "./registry";

