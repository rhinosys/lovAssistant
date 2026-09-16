import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as healthLive } from "./health/route";
import { GET as healthReady } from "./health/ready/route";
import { setModelProvider } from "@/server/model/ollama";
import { ChatModelProvider } from "@/server/model/types";
import { setForceInMemoryRepositories } from "@/server/persistence";

describe("Health & Readiness Probes", () => {
  beforeEach(() => {
    setForceInMemoryRepositories(true);
  });

  it("returns 200 on /api/health liveness probe", async () => {
    const res = await healthLive();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("admin-lova-chat");
  });

  it("returns 200 on /api/health/ready when Ollama and Database are healthy", async () => {
    const mockProvider: ChatModelProvider = {
      async *streamChat() {},
      async checkHealth() {
        return {
          healthy: true,
          latencyMs: 12,
          installedModels: ["qwen2.5:7b-instruct-q4_K_M"],
        };
      },
      async checkModelAvailability() {
        return true;
      },
    };
    setModelProvider(mockProvider);

    const res = await healthReady();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.dependencies.ollama.status).toBe("healthy");
    expect(data.dependencies.ollama.models).toContain("qwen2.5:7b-instruct-q4_K_M");
  });

  it("returns 503 on /api/health/ready when Ollama is unreachable", async () => {
    const mockProvider: ChatModelProvider = {
      async *streamChat() {},
      async checkHealth() {
        return {
          healthy: false,
          latencyMs: 100,
          error: "Connection refused to Ollama",
        };
      },
      async checkModelAvailability() {
        return false;
      },
    };
    setModelProvider(mockProvider);

    const res = await healthReady();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("unhealthy");
    expect(data.dependencies.ollama.status).toBe("unhealthy");
    expect(data.dependencies.ollama.error).toBe("Connection refused to Ollama");
  });
});
