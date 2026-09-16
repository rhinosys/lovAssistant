import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig, ConfigurationError } from "./config";

describe("Server Configuration Loader", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/admin_lova_test",
    OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    OLLAMA_MODEL: "qwen2.5:7b-instruct-q4_K_M",
    APP_BASE_URL: "http://localhost:3000",
    SESSION_SECRET: "secret-key-that-is-at-least-16-chars",
    LOG_LEVEL: "debug",
    PORT: "4000",
    NODE_ENV: "test",
  };

  it("loads valid configuration successfully", () => {
    const config = loadConfig(validEnv);
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(config.OLLAMA_BASE_URL).toBe("http://127.0.0.1:11434");
    expect(config.OLLAMA_MODEL).toBe("qwen2.5:7b-instruct-q4_K_M");
    expect(config.PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe("debug");
    expect(config.NODE_ENV).toBe("test");
  });

  it("applies default values when optional fields are omitted", () => {
    const config = loadConfig({});
    expect(config.DATABASE_URL).toBeDefined();
    expect(config.OLLAMA_BASE_URL).toBe("http://127.0.0.1:11434");
    expect(config.PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.MISTRAL_API_KEY).toBeUndefined();
    expect(config.MISTRAL_MODEL).toBe("mistral-small-latest");
    expect(config.MISTRAL_BASE_URL).toBe("https://api.mistral.ai/v1");
    expect(config.DEFAULT_LLM_PROVIDER).toBe("ollama");
  });

  it("loads Mistral configuration when provided", () => {
    const config = loadConfig({
      ...validEnv,
      MISTRAL_API_KEY: "test-mistral-key",
      MISTRAL_MODEL: "mistral-large-latest",
      DEFAULT_LLM_PROVIDER: "mistral",
    });
    expect(config.MISTRAL_API_KEY).toBe("test-mistral-key");
    expect(config.MISTRAL_MODEL).toBe("mistral-large-latest");
    expect(config.DEFAULT_LLM_PROVIDER).toBe("mistral");
  });

  it("throws ConfigurationError on invalid URL", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        OLLAMA_BASE_URL: "not-a-valid-url",
      })
    ).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError on short session secret", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        SESSION_SECRET: "short",
      })
    ).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError on invalid LOG_LEVEL", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        LOG_LEVEL: "verbose",
      })
    ).toThrow(ConfigurationError);
  });
});
