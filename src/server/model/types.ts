export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatStreamChunk {
  text: string;
  done?: boolean;
  totalTokens?: number;
}

export interface ChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  latencyMs: number;
  installedModels?: string[];
  error?: string;
}

export type OllamaHealthStatus = ProviderHealthStatus;

export type LLMProviderType = "ollama" | "mistral";

export interface ChatModelProvider {
  readonly providerType?: LLMProviderType;
  streamChat(options: ChatOptions): AsyncIterable<ChatStreamChunk>;
  checkHealth(): Promise<ProviderHealthStatus>;
  checkModelAvailability(modelName: string): Promise<boolean>;
}

export class OllamaUnavailableError extends Error {
  readonly status = 503;
  constructor(message = "Local Ollama inference engine is unreachable.") {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

export class ModelNotFoundError extends Error {
  readonly status = 404;
  constructor(public readonly modelName: string) {
    super(`Model '${modelName}' is not installed in local Ollama.`);
    this.name = "ModelNotFoundError";
  }
}

export class OllamaTimeoutError extends Error {
  readonly status = 504;
  constructor(message = "Model generation timed out.") {
    super(message);
    this.name = "OllamaTimeoutError";
  }
}

export class OllamaGenerationError extends Error {
  readonly status = 500;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "OllamaGenerationError";
  }
}

export class MistralAuthenticationError extends Error {
  readonly status = 401;
  constructor(message = "Invalid or missing Mistral API key.") {
    super(message);
    this.name = "MistralAuthenticationError";
  }
}

export class MistralRateLimitError extends Error {
  readonly status = 429;
  constructor(message = "Mistral API rate limit or quota exceeded.") {
    super(message);
    this.name = "MistralRateLimitError";
  }
}

export class MistralTimeoutError extends Error {
  readonly status = 504;
  constructor(message = "Mistral API request timed out.") {
    super(message);
    this.name = "MistralTimeoutError";
  }
}

export class MistralAPIError extends Error {
  readonly status = 500;
  constructor(message: string, public readonly statusCode = 500, public readonly cause?: unknown) {
    super(message);
    this.name = "MistralAPIError";
  }
}

