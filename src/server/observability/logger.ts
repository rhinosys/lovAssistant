import { getConfig } from "../config";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /authorization/i,
  /secret/i,
  /api[_-]?key/i,
  /cookie/i,
  /credential/i,
];

export interface LogContext {
  requestId?: string;
  userId?: string;
  threadId?: string;
  model?: string;
  latencyMs?: number;
  status?: number | string;
  errorType?: string;
  [key: string]: unknown;
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  threadId?: string;
  model?: string;
  latencyMs?: number;
  status?: number | string;
  errorType?: string;
  extra?: Record<string, unknown>;
}

export function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  if (typeof data === "object") {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        masked[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        masked[key] = maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return data;
}

export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext = {}, minLevel?: LogLevel) {
    this.context = context;
    if (minLevel) {
      this.minLevel = minLevel;
    } else {
      try {
        this.minLevel = getConfig().LOG_LEVEL;
      } catch {
        this.minLevel = "info";
      }
    }
  }

  public withContext(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext }, this.minLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private formatRecord(level: LogLevel, message: string, extra?: Record<string, unknown>): LogRecord {
    const mergedContext = { ...this.context, ...extra };
    const { requestId, userId, threadId, model, latencyMs, status, errorType, ...rest } = mergedContext;

    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (requestId) record.requestId = requestId;
    if (userId) record.userId = userId;
    if (threadId) record.threadId = threadId;
    if (model) record.model = model;
    if (latencyMs !== undefined) record.latencyMs = latencyMs;
    if (status !== undefined) record.status = status;
    if (errorType) record.errorType = errorType;

    if (Object.keys(rest).length > 0) {
      record.extra = maskSensitiveData(rest) as Record<string, unknown>;
    }

    return record;
  }

  public log(level: LogLevel, message: string, extra?: Record<string, unknown>): LogRecord | null {
    if (!this.shouldLog(level)) return null;

    const record = this.formatRecord(level, message, extra);
    const jsonStr = JSON.stringify(record);

    if (level === "error") {
      console.error(jsonStr);
    } else if (level === "warn") {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }

    return record;
  }

  public debug(message: string, extra?: Record<string, unknown>): LogRecord | null {
    return this.log("debug", message, extra);
  }

  public info(message: string, extra?: Record<string, unknown>): LogRecord | null {
    return this.log("info", message, extra);
  }

  public warn(message: string, extra?: Record<string, unknown>): LogRecord | null {
    return this.log("warn", message, extra);
  }

  public error(message: string, extra?: Record<string, unknown>): LogRecord | null {
    return this.log("error", message, extra);
  }
}

export const logger = new Logger();
