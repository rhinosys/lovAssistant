import { getConfig } from "../config";
import { decryptSecret, encryptSecret, SecretDecryptionError } from "../admin/secrets";
import { logger } from "../observability/logger";
import { getFramateamStore, IFramateamStore } from "./store";

export interface FramateamSettings {
  source: "database" | "env" | "none";
  baseUrl: string;
  teamName: string;
  loginId: string;
  // Clear text, server-side only. Never serialise this object to a client.
  password: string | null;
  passwordError: string | null;
  triggerKeyword: string;
  acceptMentions: boolean;
  syncIntervalMin: number;
}

export interface FramateamSettingsInput {
  baseUrl: string;
  teamName: string;
  loginId: string;
  // Empty or missing keeps the stored password.
  password?: string;
  triggerKeyword: string;
  acceptMentions: boolean;
  syncIntervalMin: number;
}

export const isConfigured = (s: FramateamSettings): boolean => Boolean(s.teamName && s.loginId && s.password);

// Database (admin area) first, then FRAMATEAM_* environment variables.
export async function getFramateamSettings(store: IFramateamStore = getFramateamStore()): Promise<FramateamSettings> {
  const config = getConfig();
  const stored = await store.getSettings().catch((error) => {
    logger.warn("Framateam settings unavailable from database", { error: String(error) });
    return null;
  });
  if (stored) {
    let password: string | null = null;
    let passwordError: string | null = null;
    if (stored.passwordEnc) {
      try {
        password = decryptSecret(stored.passwordEnc);
      } catch (error) {
        passwordError = error instanceof SecretDecryptionError || error instanceof Error ? error.message : "Mot de passe illisible";
      }
    }
    return {
      source: "database",
      baseUrl: stored.baseUrl,
      teamName: stored.teamName,
      loginId: stored.loginId,
      password,
      passwordError,
      triggerKeyword: stored.triggerKeyword,
      acceptMentions: stored.acceptMentions,
      syncIntervalMin: stored.syncIntervalMin,
    };
  }
  const fromEnv = Boolean(config.FRAMATEAM_TEAM && config.FRAMATEAM_LOGIN_ID && config.FRAMATEAM_PASSWORD);
  return {
    source: fromEnv ? "env" : "none",
    baseUrl: config.FRAMATEAM_URL,
    teamName: config.FRAMATEAM_TEAM ?? "",
    loginId: config.FRAMATEAM_LOGIN_ID ?? "",
    password: config.FRAMATEAM_PASSWORD || null,
    passwordError: null,
    triggerKeyword: config.FRAMATEAM_TRIGGER,
    acceptMentions: config.FRAMATEAM_ACCEPT_MENTIONS,
    syncIntervalMin: config.FRAMATEAM_SYNC_INTERVAL_MIN,
  };
}

export async function saveFramateamSettings(
  input: FramateamSettingsInput,
  updatedBy: string,
  store: IFramateamStore = getFramateamStore()
): Promise<void> {
  const existing = await store.getSettings();
  const passwordEnc = input.password ? encryptSecret(input.password) : existing?.passwordEnc ?? null;
  await store.saveSettings({
    baseUrl: input.baseUrl.replace(/\/$/, ""),
    teamName: input.teamName.trim(),
    loginId: input.loginId.trim(),
    passwordEnc,
    triggerKeyword: input.triggerKeyword.trim(),
    acceptMentions: input.acceptMentions,
    syncIntervalMin: input.syncIntervalMin,
    updatedBy,
  });
  await store.notifyConfigChanged();
}

// Safe projection for the admin UI: never includes the password.
export const publicSettings = (s: FramateamSettings) => ({
  source: s.source,
  baseUrl: s.baseUrl,
  teamName: s.teamName,
  loginId: s.loginId,
  passwordConfigured: Boolean(s.password),
  passwordError: s.passwordError,
  triggerKeyword: s.triggerKeyword,
  acceptMentions: s.acceptMentions,
  syncIntervalMin: s.syncIntervalMin,
});
