import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FramateamBot, BotApi, WebSocketLike, extractQuestion, ERROR_REPLY, BUSY_REPLY } from "./bot";
import { InMemoryFramateamStore } from "./store";
import { FramateamSettings } from "./settings";
import { FramateamAuthError } from "./client";
import { ME, post, postList } from "./__fixtures__/api";
import { MattermostPost } from "./types";

const baseSettings: FramateamSettings = {
  source: "database", baseUrl: "https://framateam.org", teamName: "lov", loginId: "assistant-lov", password: "pw",
  passwordError: null, triggerKeyword: "!lov", acceptMentions: false, syncIntervalMin: 60,
};

class FakeSocket implements WebSocketLike {
  sent: { action?: string; data?: { token?: string } }[] = [];
  closed = false;
  private listeners: Record<string, ((event: { data?: unknown }) => void)[]> = {};
  constructor(readonly url: string) {}
  addEventListener(type: string, listener: (event: { data?: unknown }) => void) { (this.listeners[type] ??= []).push(listener); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.closed = true; }
  emit(type: string, data?: unknown) { for (const l of this.listeners[type] ?? []) l({ data }); }
  hello() { this.emit("open"); this.emit("message", JSON.stringify({ event: "hello", data: {} })); }
  posted(p: MattermostPost, channelType = "O") { this.emit("message", JSON.stringify({ event: "posted", data: { channel_type: channelType, post: JSON.stringify(p) } })); }
}

const makeApi = () => {
  const calls: string[] = [];
  const api = {
    currentUser: null,
    sessionToken: "tok",
    websocketUrl: () => "wss://framateam.org/api/v4/websocket",
    login: vi.fn(async () => { calls.push("login"); return ME; }),
    getPostThread: vi.fn(async (id: string) => { calls.push(`thread:${id}`); return postList([]); }),
    getChannelPosts: vi.fn(async (id: string) => { calls.push(`posts:${id}`); return postList([]); }),
    addReaction: vi.fn(async (id: string, emoji: string) => { calls.push(`react:${id}:${emoji}`); }),
    removeReaction: vi.fn(async (id: string, emoji: string) => { calls.push(`unreact:${id}:${emoji}`); }),
    createPost: vi.fn(async (p: { channel_id: string; root_id?: string; message: string }) => { calls.push(`post:${p.root_id}`); return post("reply"); }),
  };
  return { api: api as unknown as BotApi & typeof api, calls };
};

describe("extractQuestion", () => {
  it("accepts the keyword at the start and mentions only when enabled", () => {
    expect(extractQuestion("!lov  quelle vitesse ?", baseSettings, ME)).toBe("quelle vitesse ?");
    expect(extractQuestion("!LOV, quelle vitesse ?", baseSettings, ME)).toBe("quelle vitesse ?");
    expect(extractQuestion("!lovely day", baseSettings, ME)).toBeNull();
    expect(extractQuestion("je dis !lov au milieu", baseSettings, ME)).toBeNull();
    expect(extractQuestion("@assistant-lov quelle vitesse ?", baseSettings, ME)).toBeNull();
    expect(extractQuestion("@assistant-lov quelle vitesse ?", { ...baseSettings, acceptMentions: true }, ME)).toBe("quelle vitesse ?");
  });
});

describe("FramateamBot", () => {
  let store: InMemoryFramateamStore;
  let sockets: FakeSocket[];
  let settings: FramateamSettings;
  let api: ReturnType<typeof makeApi>["api"];
  let calls: string[];
  let answer: ReturnType<typeof vi.fn>;
  let bot: FramateamBot;

  const socket = () => sockets[sockets.length - 1];
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); await bot.idle(); };

  beforeEach(async () => {
    vi.useFakeTimers();
    store = new InMemoryFramateamStore();
    await store.syncChannelList([
      { channelId: "c_laser", teamId: "t", name: "laser", displayName: "Laser" },
      { channelId: "c_3d", teamId: "t", name: "3d", displayName: "3D" },
    ]);
    await store.updateChannel("c_laser", { listenEnabled: true });
    sockets = [];
    settings = { ...baseSettings };
    ({ api, calls } = makeApi());
    answer = vi.fn(async () => ({ text: "Réponse sourcée\n\nSources : [Wiki](<https://example.org>)" }));
    bot = new FramateamBot({
      store,
      loadSettings: async () => settings,
      createClient: () => api,
      createSocket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; },
      answer,
      random: () => 0.5,
    });
    await bot.start();
    socket().hello();
    await flush();
  });

  afterEach(async () => {
    await bot.stop();
    vi.useRealTimers();
  });

  it("authenticates the websocket with the session token", () => {
    expect(socket().url).toBe("wss://framateam.org/api/v4/websocket");
    expect(socket().sent[0]).toMatchObject({ action: "authentication_challenge", data: { token: "tok" } });
  });

  it("reacts, answers in the thread and removes the reaction", async () => {
    socket().posted(post("q1", { channel_id: "c_laser", message: "!lov vitesse contreplaqué 3 mm ?" }));
    await flush();
    expect(calls).toEqual(["login", "react:q1:eyes", "post:q1", "unreact:q1:eyes"]);
    expect(answer).toHaveBeenCalledWith({ question: "vitesse contreplaqué 3 mm ?", userHistory: [{ role: "user", content: "vitesse contreplaqué 3 mm ?" }] });
    expect(api.createPost).toHaveBeenCalledWith({ channel_id: "c_laser", root_id: "q1", message: expect.stringContaining("Réponse sourcée"), props: { from_lov_assistant: true } });
  });

  it("answers questions posted by the account itself (personal account), never its own replies", async () => {
    socket().posted(post("mine", { channel_id: "c_laser", user_id: ME.id, message: "!lov quand est le prochain atelier ?" }));
    await flush();
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ question: "quand est le prochain atelier ?" }));
    expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({ root_id: "mine", props: { from_lov_assistant: true } }));
  });

  it("ignores untriggered posts, other channels, private channels, DMs and its own replies", async () => {
    socket().posted(post("a", { channel_id: "c_laser", message: "bonjour à tous" }));
    socket().posted(post("b", { channel_id: "c_3d", message: "!lov question" }));
    socket().posted(post("c", { channel_id: "c_laser", message: "!lov question" }), "P");
    socket().posted(post("d", { channel_id: "c_laser", message: "!lov question" }), "D");
    socket().posted(post("e", { channel_id: "c_laser", user_id: ME.id, props: { from_lov_assistant: true }, message: "!lov question" }));
    socket().posted(post("f", { channel_id: "c_laser", type: "system_join_channel", message: "!lov" }));
    await flush();
    expect(answer).not.toHaveBeenCalled();
    expect(api.createPost).not.toHaveBeenCalled();
  });

  it("answers a follow-up in the existing thread with previous member questions only", async () => {
    api.getPostThread.mockResolvedValueOnce(postList([
      post("root", { channel_id: "c_laser", message: "!lov réglage laser pour le médium ?", create_at: 1 }),
      post("botreply", { channel_id: "c_laser", root_id: "root", user_id: ME.id, props: { from_lov_assistant: true }, message: "réponse précédente", create_at: 2 }),
      post("q2", { channel_id: "c_laser", root_id: "root", message: "!lov et en 6 mm ?", create_at: 3 }),
    ]));
    socket().posted(post("q2", { channel_id: "c_laser", root_id: "root", message: "!lov et en 6 mm ?", create_at: 3 }));
    await flush();
    expect(answer).toHaveBeenCalledWith({
      question: "et en 6 mm ?",
      userHistory: [{ role: "user", content: "réglage laser pour le médium ?" }, { role: "user", content: "et en 6 mm ?" }],
    });
    expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({ root_id: "root" }));
  });

  it("posts a short error message when generation fails, and still removes the reaction", async () => {
    answer.mockRejectedValueOnce(new Error("LLM down"));
    socket().posted(post("q3", { channel_id: "c_laser", message: "!lov question" }));
    await flush();
    expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({ message: ERROR_REPLY }));
    expect(calls).toContain("unreact:q3:eyes");
  });

  it("explains how to ask when the keyword comes alone", async () => {
    socket().posted(post("q4", { channel_id: "c_laser", message: "!lov" }));
    await flush();
    expect(answer).not.toHaveBeenCalled();
    expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Pose ta question après « !lov »") }));
  });

  it("handles a post only once and limits concurrent work", async () => {
    const releases: (() => void)[] = [];
    answer.mockImplementation(() => new Promise((resolve) => { releases.push(() => resolve({ text: "ok" })); }));
    socket().posted(post("same", { channel_id: "c_laser", message: "!lov a" }));
    socket().posted(post("same", { channel_id: "c_laser", message: "!lov a" }));
    for (const id of ["x1", "x2", "x3"]) socket().posted(post(id, { channel_id: "c_laser", message: "!lov b" }));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({ root_id: "x3", message: BUSY_REPLY }));
    // Per-channel queue: answers run one after the other.
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 20 && releases.length === round; i++) await Promise.resolve();
      expect(releases).toHaveLength(round + 1);
      releases[round]();
    }
    await flush();
    expect(api.addReaction.mock.calls.filter(([id]) => id === "same")).toHaveLength(1);
    expect(api.createPost.mock.calls.map(([p]) => p.root_id)).toEqual(["x3", "same", "x1", "x2"]);
  });

  it("reconnects with capped exponential backoff and catches up missed triggers", async () => {
    socket().posted(post("seen", { channel_id: "c_laser", message: "hello", create_at: Date.now() }));
    socket().emit("close");
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1499);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await flush();
    expect(sockets).toHaveLength(2);

    socket().emit("close");
    vi.advanceTimersByTime(2999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    await flush();
    expect(sockets).toHaveLength(3);

    api.getChannelPosts.mockResolvedValueOnce(postList([post("missed", { channel_id: "c_laser", message: "!lov question manquée", create_at: Date.now() + 1 })]));
    socket().hello();
    await flush();
    expect(api.getChannelPosts).toHaveBeenCalledWith("c_laser", { since: expect.any(Number) });
    expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({ root_id: "missed" }));
  });

  it("pings regularly and reconnects when the socket stays silent", async () => {
    vi.advanceTimersByTime(30_000);
    expect(socket().sent.some((m) => m.action === "ping")).toBe(true);
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(30_000);
    expect(sockets[0].closed).toBe(true);
    vi.advanceTimersByTime(2_000);
    await flush();
    expect(sockets.length).toBeGreaterThan(1);
  });

  it("re-logs in and reconnects when credentials change in the admin", async () => {
    settings = { ...settings, password: "new-password" };
    await store.notifyConfigChanged();
    await flush();
    expect(sockets[0].closed).toBe(true);
    expect(api.login).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(2);
  });

  it("picks up listen-flag changes without reconnecting", async () => {
    await store.updateChannel("c_3d", { listenEnabled: true });
    await store.notifyConfigChanged();
    await flush();
    expect(sockets).toHaveLength(1);
    socket().posted(post("q5", { channel_id: "c_3d", message: "!lov buse bouchée ?" }));
    await flush();
    expect(answer).toHaveBeenCalled();
  });

  it("stays idle when unconfigured and starts once settings are saved", async () => {
    await bot.stop();
    sockets = [];
    settings = { ...baseSettings, source: "none", password: null, teamName: "" };
    await bot.start();
    expect(sockets).toHaveLength(0);
    settings = { ...baseSettings };
    await store.notifyConfigChanged();
    await flush();
    expect(sockets).toHaveLength(1);
  });

  it("backs off when the login is refused", async () => {
    await bot.stop();
    sockets = [];
    api.login.mockRejectedValue(new FramateamAuthError());
    await bot.start();
    expect(sockets).toHaveLength(0);
    vi.advanceTimersByTime(1_500);
    await flush();
    expect(api.login.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(sockets).toHaveLength(0);
  });

  it("runs the periodic sync at the configured interval", async () => {
    await bot.stop();
    const runSync = vi.fn(async () => undefined);
    bot = new FramateamBot({ store, loadSettings: async () => settings, createClient: () => api, createSocket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; }, answer, runSync });
    await bot.start();
    vi.advanceTimersByTime(60 * 60_000 - 1);
    expect(runSync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(runSync).toHaveBeenCalledTimes(1);
  });
});
