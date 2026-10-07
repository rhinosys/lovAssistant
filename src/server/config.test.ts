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

  it("parses admin and Framateam settings with safe defaults", () => {
    const config = loadConfig({});
    expect(config.ADMIN_USERS).toEqual([]);
    expect(config.TRUST_PROXY_ADMIN_HEADER).toBe(false);
    expect(config.FRAMATEAM_URL).toBe("https://framateam.org");
    expect(config.FRAMATEAM_TRIGGER).toBe("!lov");
    expect(config.FRAMATEAM_ACCEPT_MENTIONS).toBe(false);
    expect(config.FRAMATEAM_SYNC_INTERVAL_MIN).toBe(60);

    const custom = loadConfig({ ADMIN_USERS: "a, b,,", TRUST_PROXY_ADMIN_HEADER: "true", FRAMATEAM_SYNC_INTERVAL_MIN: "30" });
    expect(custom.ADMIN_USERS).toEqual(["a", "b"]);
    expect(custom.TRUST_PROXY_ADMIN_HEADER).toBe(true);
    expect(custom.FRAMATEAM_SYNC_INTERVAL_MIN).toBe(30);
  });

  it("rejects a sync interval below 15 minutes and malformed encryption keys", () => {
    expect(() => loadConfig({ FRAMATEAM_SYNC_INTERVAL_MIN: "5" })).toThrow(ConfigurationError);
    expect(() => loadConfig({ APP_ENCRYPTION_KEY: "too-short" })).toThrow(ConfigurationError);
    expect(loadConfig({ APP_ENCRYPTION_KEY: "a".repeat(64) }).APP_ENCRYPTION_KEY).toBe("a".repeat(64));
    expect(loadConfig({ APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") }).APP_ENCRYPTION_KEY).toBeDefined();
  });
});

