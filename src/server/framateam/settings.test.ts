import { describe, it, expect, afterEach, vi } from "vitest";
import { InMemoryFramateamStore } from "./store";
import { getFramateamSettings, saveFramateamSettings, publicSettings, isConfigured } from "./settings";
import { resetConfigCache } from "../config";
import { SecretKeyMissingError } from "../admin/secrets";

const env = (vars: Record<string, string>) => {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  resetConfigCache();
};
const input = { baseUrl: "https://framateam.org/", teamName: "lov", loginId: "assistant-lov", password: "s3cret", triggerKeyword: "!lov", acceptMentions: false, syncIntervalMin: 60 };

describe("Framateam settings resolution", () => {
  afterEach(() => { vi.unstubAllEnvs(); resetConfigCache(); });

  it("returns 'none' when nothing is configured", async () => {
    env({ FRAMATEAM_TEAM: "", FRAMATEAM_LOGIN_ID: "", FRAMATEAM_PASSWORD: "" });
    const settings = await getFramateamSettings(new InMemoryFramateamStore());
    expect(settings.source).toBe("none");
    expect(isConfigured(settings)).toBe(false);
  });

  it("falls back to environment variables", async () => {
    env({ FRAMATEAM_TEAM: "lov", FRAMATEAM_LOGIN_ID: "nrineau", FRAMATEAM_PASSWORD: "envpass" });
    const settings = await getFramateamSettings(new InMemoryFramateamStore());
    expect(settings).toMatchObject({ source: "env", teamName: "lov", loginId: "nrineau", password: "envpass" });
  });

  it("prefers the database, decrypts the password and keeps it when the field is left empty", async () => {
    env({ FRAMATEAM_TEAM: "env-team", FRAMATEAM_LOGIN_ID: "x", FRAMATEAM_PASSWORD: "y", APP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64") });
    const store = new InMemoryFramateamStore();
    const notified = vi.fn();
    await store.onConfigChanged(notified);

    await saveFramateamSettings(input, "nicolas", store);
    expect(store.settings?.passwordEnc).not.toContain("s3cret");
    expect(store.settings?.baseUrl).toBe("https://framateam.org");
    expect(notified).toHaveBeenCalledTimes(1);

    await saveFramateamSettings({ ...input, password: "", teamName: "lov2" }, "nicolas", store);
    const settings = await getFramateamSettings(store);
    expect(settings).toMatchObject({ source: "database", teamName: "lov2", password: "s3cret" });

    const exposed = JSON.stringify(publicSettings(settings));
    expect(exposed).not.toContain("s3cret");
    expect(publicSettings(settings).passwordConfigured).toBe(true);
  });

  it("refuses to store a password without an encryption key", async () => {
    env({ APP_ENCRYPTION_KEY: "" });
    const store = new InMemoryFramateamStore();
    await expect(saveFramateamSettings(input, "nicolas", store)).rejects.toBeInstanceOf(SecretKeyMissingError);
    expect(store.settings).toBeNull();
  });
});
