import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MistralProvider } from "./mistral";
import {
  MistralAuthenticationError,
  MistralRateLimitError,
  MistralTimeoutError,
  MistralAPIError,
} from "./types";

describe("Mistral Model Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("streams chat tokens progressively from Mistral SSE stream", async () => {
    const sseLines = [
      'data: {"id":"chat-1","choices":[{"index":0,"delta":{"role":"assistant","content":"Bonjour "},"finish_reason":null}]}\n\n',
      'data: {"id":"chat-1","choices":[{"index":0,"delta":{"content":"Mistral !"},"finish_reason":null}]}\n\n',
      'data: {"id":"chat-1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
      "data: [DONE]\n\n",
    ];

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      start(controller) {
        for (const chunk of sseLines) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readableStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );

    const provider = new MistralProvider("test-key", "https://api.mistral.ai/v1", "mistral-small-latest");
    const chunks: string[] = [];
    let lastTotalTokens = 0;

    for await (const chunk of provider.streamChat({
      messages: [{ role: "user", content: "Salut" }],
    })) {
      if (chunk.text) {
        chunks.push(chunk.text);
      }
      if (chunk.totalTokens) {
        lastTotalTokens = chunk.totalTokens;
      }
    }

    expect(chunks.join("")).toBe("Bonjour Mistral !");
    expect(lastTotalTokens).toBe(15);
  });

  it("throws MistralAuthenticationError when API key is missing", async () => {
    const provider = new MistralProvider("", "https://api.mistral.ai/v1");
    const generator = provider.streamChat({
      messages: [{ role: "user", content: "Hello" }],
    });

    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(MistralAuthenticationError);
  });

  it("throws MistralAuthenticationError when Mistral API returns HTTP 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized: Invalid API Key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    const provider = new MistralProvider("invalid-key", "https://api.mistral.ai/v1");
    const generator = provider.streamChat({
      messages: [{ role: "user", content: "Test" }],
    });

    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(MistralAuthenticationError);
  });

  it("throws MistralRateLimitError when Mistral API returns HTTP 429", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const provider = new MistralProvider("test-key", "https://api.mistral.ai/v1");
    const generator = provider.streamChat({
      messages: [{ role: "user", content: "Test" }],
    });

    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(MistralRateLimitError);
  });

  it("throws MistralTimeoutError on abort signal", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const provider = new MistralProvider("test-key", "https://api.mistral.ai/v1");
    const generator = provider.streamChat({
      messages: [{ role: "user", content: "Test" }],
    });

    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(MistralTimeoutError);
  });

  it("throws MistralAPIError when upstream returns 500", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      })
    );

    const provider = new MistralProvider("test-key", "https://api.mistral.ai/v1");
    const generator = provider.streamChat({
      messages: [{ role: "user", content: "Test" }],
    });

    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(MistralAPIError);
  });

  it("reports healthy status with available models from /v1/models", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              { id: "mistral-small-latest", object: "model", created: 1700000000, owned_by: "mistralai" },
              { id: "mistral-large-latest", object: "model", created: 1700000000, owned_by: "mistralai" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const provider = new MistralProvider("test-key", "https://api.mistral.ai/v1");
    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.installedModels).toContain("mistral-small-latest");
    expect(health.installedModels).toContain("mistral-large-latest");

    const available = await provider.checkModelAvailability("mistral-small-latest");
    expect(available).toBe(true);
  });
});
