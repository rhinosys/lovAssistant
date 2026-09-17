import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OllamaProvider } from "./ollama";
import {
  OllamaUnavailableError,
  ModelNotFoundError,
} from "./types";

describe("Ollama Model Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("streams chat tokens progressively from Ollama HTTP ndjson stream", async () => {
    const streamChunks = [
      JSON.stringify({ message: { content: "Bonjour " }, done: false }) + "\n",
      JSON.stringify({ message: { content: "Fablab !" }, done: false }) + "\n",
      JSON.stringify({ done: true, eval_count: 5 }) + "\n",
    ];

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      start(controller) {
        for (const chunk of streamChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(readableStream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      })
    );

    const provider = new OllamaProvider("http://127.0.0.1:11434", "qwen2.5:7b");
    const chunks: string[] = [];

    for await (const chunk of provider.streamChat({
      messages: [{ role: "user", content: "Salut" }],
    })) {
      if (chunk.text) {
        chunks.push(chunk.text);
      }
    }

    expect(chunks.join("")).toBe("Bonjour Fablab !");
  });

  it("throws OllamaUnavailableError when fetch network connection is refused", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));

    const provider = new OllamaProvider("http://127.0.0.1:11434");
    const generator = provider.streamChat({
      messages: [{ role: "user", content: "Test" }],
    });

    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(OllamaUnavailableError);
  });

  it("throws ModelNotFoundError when Ollama returns 404 model not found", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "model 'unknown:latest' not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    const provider = new OllamaProvider("http://127.0.0.1:11434", "unknown:latest");
    const generator = provider.streamChat({
      messages: [{ role: "user", content: "Test" }],
    });

    await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(ModelNotFoundError);
  });

  it("reports healthy status with installed model tags", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            models: [
              { name: "qwen2.5:7b-instruct-q4_K_M", model: "qwen2.5:7b", size: 4000000000 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const provider = new OllamaProvider("http://127.0.0.1:11434");
    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.installedModels).toContain("qwen2.5:7b-instruct-q4_K_M");

    const available = await provider.checkModelAvailability("qwen2.5:7b-instruct-q4_K_M");
    expect(available).toBe(true);
  });
});
