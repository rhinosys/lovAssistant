import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger, maskSensitiveData } from "./logger";

describe("Structured Logger & Credential Masking", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("masks sensitive keys in nested objects", () => {
    const raw = {
      user: "alice",
      password: "my-super-secret-password",
      authorization: "Bearer eyJhbGciOi...",
      headers: {
        cookie: "session_id=12345",
        apiKey: "sk-live-1234567890",
        nested: {
          secretToken: "secret_val",
          normalField: "visible",
        },
      },
    };

    const masked = maskSensitiveData(raw) as any;
    expect(masked.user).toBe("alice");
    expect(masked.password).toBe("[REDACTED]");
    expect(masked.authorization).toBe("[REDACTED]");
    expect(masked.headers.cookie).toBe("[REDACTED]");
    expect(masked.headers.apiKey).toBe("[REDACTED]");
    expect(masked.headers.nested.secretToken).toBe("[REDACTED]");
    expect(masked.headers.nested.normalField).toBe("visible");
  });

  it("produces structured JSON records with contextual fields", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const customLogger = new Logger({ requestId: "req-123", userId: "usr-456" }, "debug");

    const record = customLogger.info("Chat request completed", {
      threadId: "thr-789",
      model: "qwen2.5:7b",
      latencyMs: 145,
      status: 200,
      token: "must-be-redacted",
    });

    expect(record).not.toBeNull();
    expect(record?.message).toBe("Chat request completed");
    expect(record?.requestId).toBe("req-123");
    expect(record?.userId).toBe("usr-456");
    expect(record?.threadId).toBe("thr-789");
    expect(record?.model).toBe("qwen2.5:7b");
    expect(record?.latencyMs).toBe(145);
    expect(record?.status).toBe(200);
    expect(record?.extra?.token).toBe("[REDACTED]");
    expect(consoleSpy).toHaveBeenCalledOnce();
  });

  it("respects log level thresholds", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnLogger = new Logger({}, "warn");

    const debugRecord = warnLogger.debug("Should not log");
    expect(debugRecord).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();

    const infoRecord = warnLogger.info("Should not log");
    expect(infoRecord).toBeNull();
    expect(consoleSpy).not.toHaveBeenCalled();

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const warnRecord = warnLogger.warn("Should log warning");
    expect(warnRecord).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("creates child loggers with enriched context via withContext()", () => {
    const baseLogger = new Logger({ requestId: "req-abc" }, "info");
    const childLogger = baseLogger.withContext({ userId: "usr-xyz" });

    const record = childLogger.info("Child log event");
    expect(record?.requestId).toBe("req-abc");
    expect(record?.userId).toBe("usr-xyz");
  });
});
