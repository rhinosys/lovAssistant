import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default("postgresql://postgres:postgres@localhost:5432/admin_lova"),
  OLLAMA_BASE_URL: z
    .string()
    .url("OLLAMA_BASE_URL must be a valid URL")
    .default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z
    .string()
    .min(1, "OLLAMA_MODEL is required")
    .default("qwen2.5:7b-instruct-q4_K_M"),
  APP_BASE_URL: z
    .string()
    .url("APP_BASE_URL must be a valid URL")
    .default("http://localhost:3000"),
  PORT: z
    .coerce
    .number()
    .int()
    .positive()
    .default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters long")
    .default("development-session-secret-change-in-prod"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
  YESWIKI_BASE_URL: z
    .string()
    .url("YESWIKI_BASE_URL must be a valid URL")
    .default("https://labovilleurbanne.fr/yeswiki/"),
  YESWIKI_COOKIE: z
    .string()
    .optional(),
  MISTRAL_API_KEY: z
    .string()
    .optional(),
  MISTRAL_MODEL: z
    .string()
    .min(1)
    .default("mistral-small-latest"),
  MISTRAL_BASE_URL: z
    .string()
    .url("MISTRAL_BASE_URL must be a valid URL")
    .default("https://api.mistral.ai/v1"),
  DEFAULT_LLM_PROVIDER: z
    .enum(["ollama", "mistral"])
    .default("ollama"),
  // Development only: comma-separated usernames granted the admin role.
  ADMIN_USERS: z
    .string()
    .default("")
    .transform((value) => value.split(",").map((name) => name.trim()).filter(Boolean)),
  // Set by the YunoHost package, whose nginx sets X-Lov-Admin only behind the `admin` permission.
  TRUST_PROXY_ADMIN_HEADER: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // 32-byte key (base64 or hex) encrypting secrets stored in the database.
  APP_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine((value) => !value || decodeKey(value) !== null, "APP_ENCRYPTION_KEY must be 32 bytes in base64 or hex"),
  FRAMATEAM_URL: z
    .string()
    .url("FRAMATEAM_URL must be a valid URL")
    .default("https://framateam.org"),
  FRAMATEAM_TEAM: z.string().optional(),
  FRAMATEAM_LOGIN_ID: z.string().optional(),
  FRAMATEAM_PASSWORD: z.string().optional(),
  FRAMATEAM_TRIGGER: z.string().min(1).default("!lov"),
  FRAMATEAM_ACCEPT_MENTIONS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  FRAMATEAM_SYNC_INTERVAL_MIN: z.coerce.number().int().min(15).default(60),
  FRAMATEAM_INDEX_CHANNELS: z.string().optional(),
  FRAMATEAM_LISTEN_CHANNELS: z.string().optional(),
});

export function decodeKey(value: string): Buffer | null {
  const trimmed = value.trim();
  const buffer = /^[0-9a-fA-F]{64}$/.test(trimmed) ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
  return buffer.length === 32 ? buffer : null;
}

export type AppConfig = z.infer<typeof configSchema>;

export class ConfigurationError extends Error {
  constructor(message: string, public readonly issues?: z.ZodIssue[]) {
    super(message);
    this.name = "ConfigurationError";
  }
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const normalizedEnv = {
    ...env,
    MISTRAL_API_KEY: env.MISTRAL_API_KEY || env.MISTRAL_API_TOKEN,
  };
  const result = configSchema.safeParse(normalizedEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ConfigurationError(
      `Invalid server configuration:\n${errorDetails}`,
      result.error.issues
    );
  }
  return result.data;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
