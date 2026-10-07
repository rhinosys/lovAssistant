import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getMe } from "./admin/me/route";
import { GET as getSettings, PUT as putSettings } from "./admin/framateam/settings/route";
import { POST as postTest } from "./admin/framateam/test/route";
import { GET as getChannels } from "./admin/framateam/channels/route";
import { PATCH as patchChannel } from "./admin/framateam/channels/[id]/route";
import { GET as getSync, POST as postSync } from "./admin/framateam/sync/route";
import { POST as postForget } from "./admin/framateam/forget/route";
import { setForceInMemoryRepositories } from "@/server/persistence";
import { InMemoryFramateamStore, setFramateamStore, SyncBusyError } from "@/server/framateam/store";
import { FramateamClient, FramateamAuthError, FramateamMfaRequiredError } from "@/server/framateam/client";
import { resetConfigCache } from "@/server/config";
import { CHANNELS, ME, TEAM } from "@/server/framateam/__fixtures__/api";
import * as sync from "@/server/framateam/sync";

const ADMIN = { "x-username": "nrineau" };
const MEMBER = { "x-username": "alice" };
const SAME_ORIGIN = { origin: "http://localhost", host: "localhost" };

const req = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { ...headers, ...(method !== "GET" ? SAME_ORIGIN : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

const settingsBody = { baseUrl: "https://framateam.org", teamName: "lov", loginId: "nrineau", password: "TopSecret!42", triggerKeyword: "!lov", acceptMentions: false, syncIntervalMin: 60 };
const noCtx = undefined as never;

describe("Admin API (/api/admin)", () => {
  let store: InMemoryFramateamStore;

  beforeEach(() => {
    setForceInMemoryRepositories(true);
    store = new InMemoryFramateamStore();
    setFramateamStore(store);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ADMIN_USERS", "nrineau");
    vi.stubEnv("APP_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("FRAMATEAM_TEAM", "");
    vi.stubEnv("FRAMATEAM_LOGIN_ID", "");
    vi.stubEnv("FRAMATEAM_PASSWORD", "");
    resetConfigCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetConfigCache();
    setFramateamStore(null);
  });

  it("refuses every admin route to members", async () => {
    const responses = await Promise.all([
      getMe(req("GET", "/api/admin/me", MEMBER), noCtx),
      getSettings(req("GET", "/api/admin/framateam/settings", MEMBER), noCtx),
      putSettings(req("PUT", "/api/admin/framateam/settings", MEMBER, settingsBody), noCtx),
      postTest(req("POST", "/api/admin/framateam/test", MEMBER), noCtx),
      getChannels(req("GET", "/api/admin/framateam/channels", MEMBER), noCtx),
      patchChannel(req("PATCH", "/api/admin/framateam/channels/c", MEMBER, { indexEnabled: true }), { params: Promise.resolve({ id: "c" }) }),
      postSync(req("POST", "/api/admin/framateam/sync", MEMBER), noCtx),
      postForget(req("POST", "/api/admin/framateam/forget", MEMBER, { channel: "laser" }), noCtx),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("FORBIDDEN");
    }
    expect(store.settings).toBeNull();
  });

  it("refuses cross-site mutations even from an admin", async () => {
    const request = new NextRequest("http://localhost/api/admin/framateam/settings", {
      method: "PUT", headers: { ...ADMIN, origin: "https://evil.example", host: "localhost" }, body: JSON.stringify(settingsBody),
    });
    expect((await putSettings(request, noCtx)).status).toBe(403);
  });

  it("saves settings without ever returning the password", async () => {
    expect((await getMe(req("GET", "/api/admin/me", ADMIN), noCtx)).status).toBe(200);
    const saved = await putSettings(req("PUT", "/api/admin/framateam/settings", ADMIN, settingsBody), noCtx);
    const savedText = await saved.text();
    expect(saved.status).toBe(200);
    expect(savedText).not.toContain("TopSecret");
    expect(JSON.parse(savedText).settings).toMatchObject({ source: "database", passwordConfigured: true, teamName: "lov" });
    expect(store.settings?.passwordEnc).not.toContain("TopSecret");

    // Empty password keeps the stored one.
    await putSettings(req("PUT", "/api/admin/framateam/settings", ADMIN, { ...settingsBody, password: "", teamName: "lov2" }), noCtx);
    const read = await getSettings(req("GET", "/api/admin/framateam/settings", ADMIN), noCtx);
    const readText = await read.text();
    expect(readText).not.toContain("TopSecret");
    expect(JSON.parse(readText).settings).toMatchObject({ teamName: "lov2", passwordConfigured: true });
  });

  it("validates settings input", async () => {
    const response = await putSettings(req("PUT", "/api/admin/framateam/settings", ADMIN, { ...settingsBody, baseUrl: "http://insecure", syncIntervalMin: 5 }), noCtx);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("reports a missing encryption key instead of storing the password in clear", async () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    resetConfigCache();
    const response = await putSettings(req("PUT", "/api/admin/framateam/settings", ADMIN, settingsBody), noCtx);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("ENCRYPTION_KEY_MISSING");
    expect(store.settings).toBeNull();
  });

  it("tests the connection and maps auth and MFA errors", async () => {
    await putSettings(req("PUT", "/api/admin/framateam/settings", ADMIN, settingsBody), noCtx);
    vi.spyOn(FramateamClient.prototype, "getTeamByName").mockResolvedValue(TEAM);
    const login = vi.spyOn(FramateamClient.prototype, "login").mockResolvedValue(ME);
    const ok = await postTest(req("POST", "/api/admin/framateam/test", ADMIN), noCtx);
    expect(await ok.json()).toEqual({ username: "assistant-lov", team: "LOV" });

    login.mockRejectedValueOnce(new FramateamAuthError());
    const refused = await postTest(req("POST", "/api/admin/framateam/test", ADMIN), noCtx);
    const refusedText = await refused.text();
    expect(JSON.parse(refusedText).error.code).toBe("FRAMATEAM_AUTH_FAILED");
    expect(refusedText).not.toContain("TopSecret");

    login.mockRejectedValueOnce(new FramateamMfaRequiredError());
    expect((await (await postTest(req("POST", "/api/admin/framateam/test", ADMIN), noCtx)).json()).error.code).toBe("FRAMATEAM_MFA_REQUIRED");
  });

  it("lists channels disabled by default and toggles flags, purging content when indexing is disabled", async () => {
    await putSettings(req("PUT", "/api/admin/framateam/settings", ADMIN, settingsBody), noCtx);
    vi.spyOn(FramateamClient.prototype, "getTeamByName").mockResolvedValue(TEAM);
    vi.spyOn(FramateamClient.prototype, "listPublicChannels").mockResolvedValue(CHANNELS.filter((c) => c.type === "O" && !c.delete_at));
    const listed = await (await getChannels(req("GET", "/api/admin/framateam/channels?refresh=1", ADMIN), noCtx)).json();
    expect(listed.channels.map((c: { name: string }) => c.name)).toEqual(["laser", "impression-3d"]);
    expect(listed.channels.every((c: { indexEnabled: boolean; listenEnabled: boolean }) => !c.indexEnabled && !c.listenEnabled)).toBe(true);

    const notified = vi.fn();
    await store.onConfigChanged(notified);
    const patched = await patchChannel(req("PATCH", "/api/admin/framateam/channels/c_laser", ADMIN, { indexEnabled: true, listenEnabled: true }), { params: Promise.resolve({ id: "c_laser" }) });
    expect((await patched.json()).channel).toMatchObject({ indexEnabled: true, listenEnabled: true });
    expect(notified).toHaveBeenCalled();

    await store.replaceThreadChunks("r", [{ id: "r#0", rootPostId: "r", channelId: "c_laser", chunkIndex: 0, content: "x", permalink: "p", threadCreatedAt: new Date(), threadUpdatedAt: new Date(), contentHash: "h", postIds: ["r"], embedding: null }]);
    await patchChannel(req("PATCH", "/api/admin/framateam/channels/c_laser", ADMIN, { indexEnabled: false }), { params: Promise.resolve({ id: "c_laser" }) });
    expect(store.chunks.size).toBe(0);

    const missing = await patchChannel(req("PATCH", "/api/admin/framateam/channels/nope", ADMIN, { indexEnabled: true }), { params: Promise.resolve({ id: "nope" }) });
    expect(missing.status).toBe(404);
  });

  it("starts a sync, reports its status and refuses a concurrent one", async () => {
    let finish!: () => void;
    vi.spyOn(sync, "runFramateamSync").mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ startedAt: "", finishedAt: "", channels: [], purgedChannels: 0 }); }));
    const started = await postSync(req("POST", "/api/admin/framateam/sync", ADMIN), noCtx);
    expect(started.status).toBe(202);
    expect((await (await getSync(req("GET", "/api/admin/framateam/sync", ADMIN), noCtx)).json()).sync.running).toBe(true);

    const busy = await postSync(req("POST", "/api/admin/framateam/sync", ADMIN), noCtx);
    expect(busy.status).toBe(409);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await (await getSync(req("GET", "/api/admin/framateam/sync", ADMIN), noCtx)).json()).sync).toMatchObject({ running: false, error: null });
  });

  it("returns 409 when another process holds the sync lock", async () => {
    vi.spyOn(sync, "runFramateamSync").mockRejectedValue(new SyncBusyError());
    const response = await postSync(req("POST", "/api/admin/framateam/sync", ADMIN), noCtx);
    expect(response.status).toBe(409);
  });

  it("forgets a message by permalink and a channel by name", async () => {
    await store.syncChannelList([{ channelId: "c_laser", teamId: "t", name: "laser", displayName: "Laser" }]);
    await store.updateChannel("c_laser", { indexEnabled: true });
    await store.replaceThreadChunks("r", [{ id: "r#0", rootPostId: "r", channelId: "c_laser", chunkIndex: 0, content: "x", permalink: "p", threadCreatedAt: new Date(), threadUpdatedAt: new Date(), contentHash: "h", postIds: ["r", "reply"], embedding: null }]);

    const post = await (await postForget(req("POST", "/api/admin/framateam/forget", ADMIN, { post: "https://framateam.org/lov/pl/reply" }), noCtx)).json();
    expect(post.post).toMatchObject({ postId: "reply", rootPostId: "r", threadRemoved: true });
    expect(store.forgotten.has("reply")).toBe(true);
    expect(store.chunks.size).toBe(0);

    const channel = await postForget(req("POST", "/api/admin/framateam/forget", ADMIN, { channel: "~laser" }), noCtx);
    expect(await channel.json()).toMatchObject({ channel: { name: "laser" }, removedChunks: 0 });
    expect((await store.getChannel("c_laser"))?.indexEnabled).toBe(false);

    const invalid = await postForget(req("POST", "/api/admin/framateam/forget", ADMIN, { post: "a b/c" }), noCtx);
    expect(invalid.status).toBe(400);
  });
});
