import { describe, it, expect, vi } from "vitest";
import { FramateamClient, FramateamAuthError, FramateamMfaRequiredError, FramateamApiError } from "./client";
import { CHANNELS, ME, TEAM, json, loginResponse, post, postList } from "./__fixtures__/api";

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

const setup = (...handlers: (Handler | Response)[]) => {
  const calls: { url: URL; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  let clock = 0;
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const handler = handlers.shift();
    if (!handler) throw new Error(`unexpected request ${url}`);
    return typeof handler === "function" ? handler(url, init) : handler;
  });
  const client = new FramateamClient(
    { baseUrl: "https://framateam.org/", loginId: "assistant-lov", password: "pw" },
    { fetch: fetchMock as unknown as typeof fetch, sleep: async (ms) => { sleeps.push(ms); clock += ms; }, now: () => clock, minSpacingMs: 250 }
  );
  return { client, calls, sleeps };
};

describe("FramateamClient", () => {
  it("logs in with login_id/password and keeps the Token header", async () => {
    const { client, calls } = setup(loginResponse("tok-abc"));
    const me = await client.login();
    expect(me).toEqual(ME);
    expect(client.sessionToken).toBe("tok-abc");
    expect(calls[0].url.pathname).toBe("/api/v4/users/login");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ login_id: "assistant-lov", password: "pw" });
  });

  it("maps refused credentials and MFA to typed errors", async () => {
    const refused = setup(() => json({ id: "api.user.login.invalid_credentials_email_username", message: "bad" }, { status: 401 }));
    await expect(refused.client.login()).rejects.toBeInstanceOf(FramateamAuthError);
    const mfa = setup(() => json({ id: "mfa.validate_token.authenticate.app_error" }, { status: 401 }));
    await expect(mfa.client.login()).rejects.toBeInstanceOf(FramateamMfaRequiredError);
  });

  it("logs in lazily, sends the bearer token and spaces requests", async () => {
    const { client, calls, sleeps } = setup(loginResponse("tok-1"), () => json(TEAM), () => json(TEAM));
    await client.getTeamByName("lov");
    await client.getTeamByName("lov");
    expect(calls.map((c) => c.url.pathname)).toEqual(["/api/v4/users/login", "/api/v4/teams/name/lov", "/api/v4/teams/name/lov"]);
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect(sleeps.every((ms) => ms <= 250)).toBe(true);
    expect(sleeps.length).toBeGreaterThanOrEqual(2);
  });

  it("re-logs in once on 401 and replays the request", async () => {
    const { client, calls } = setup(
      loginResponse("old"),
      () => json({ id: "api.context.session_expired.app_error" }, { status: 401 }),
      loginResponse("new"),
      () => json(TEAM),
    );
    await expect(client.getTeamByName("lov")).resolves.toEqual(TEAM);
    expect(client.sessionToken).toBe("new");
    expect((calls[3].init.headers as Record<string, string>).Authorization).toBe("Bearer new");
  });

  it("fails with an auth error when the replay is refused again", async () => {
    const { client } = setup(
      loginResponse("a"),
      () => json({ message: "expired" }, { status: 401 }),
      loginResponse("b"),
      () => json({ message: "still expired" }, { status: 401 }),
    );
    await expect(client.getMe()).rejects.toBeInstanceOf(FramateamAuthError);
  });

  it("waits Retry-After on 429 and backs off exponentially on 5xx", async () => {
    const { client, sleeps } = setup(
      loginResponse(),
      () => new Response("", { status: 429, headers: { "Retry-After": "30" } }),
      () => new Response("", { status: 502 }),
      () => { throw new TypeError("fetch failed"); },
      () => json(TEAM),
    );
    await expect(client.getTeamByName("lov")).resolves.toEqual(TEAM);
    expect(sleeps).toContain(30_000);
    expect(sleeps).toContain(2_000);
    expect(sleeps).toContain(4_000);
  });

  it("gives up after the maximum number of attempts", async () => {
    const { client } = setup(loginResponse(), ...Array.from({ length: 5 }, () => () => new Response("", { status: 503 })));
    await expect(client.getMe()).rejects.toBeInstanceOf(FramateamApiError);
  });

  it("lists only public, non-archived channels across pages", async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => ({ ...CHANNELS[0], id: `c${i}` }));
    const { client, calls } = setup(loginResponse(), () => json(fullPage), () => json(CHANNELS));
    const channels = await client.listPublicChannels("t_lov");
    expect(calls[1].url.search).toBe("?page=0&per_page=200");
    expect(calls[2].url.search).toBe("?page=1&per_page=200");
    expect(channels.map((c) => c.id)).toContain("c_laser");
    expect(channels.map((c) => c.id)).not.toContain("c_private");
    expect(channels.map((c) => c.id)).not.toContain("c_archived");
    expect(channels).toHaveLength(202);
  });

  it("fetches posts by page or since, and threads", async () => {
    const list = postList([post("p1"), post("p2", { root_id: "p1" })]);
    const { client, calls } = setup(loginResponse(), () => json(list), () => json(list), () => json(list));
    await client.getChannelPosts("c_laser", { page: 3 });
    await client.getChannelPosts("c_laser", { since: 1_700_000_000_000 });
    const thread = await client.getPostThread("p1");
    expect(calls[1].url.pathname + calls[1].url.search).toBe("/api/v4/channels/c_laser/posts?page=3&per_page=200");
    expect(calls[2].url.search).toBe("?since=1700000000000");
    expect(calls[3].url.pathname).toBe("/api/v4/posts/p1/thread");
    expect(thread.order).toEqual(["p1", "p2"]);
  });

  it("posts replies in thread and manages reactions as the logged-in user", async () => {
    const { client, calls } = setup(loginResponse(), () => json({}, { status: 201 }), () => json(post("r1"), { status: 201 }), () => new Response(null, { status: 200 }));
    await client.addReaction("p1", "eyes");
    await client.createPost({ channel_id: "c_laser", root_id: "p1", message: "Réponse" });
    await client.removeReaction("p1", "eyes");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ user_id: "u_bot", post_id: "p1", emoji_name: "eyes" });
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ channel_id: "c_laser", root_id: "p1", message: "Réponse" });
    expect(calls[3].init.method).toBe("DELETE");
    expect(calls[3].url.pathname).toBe("/api/v4/users/u_bot/posts/p1/reactions/eyes");
  });

  it("builds websocket and permalink URLs", () => {
    const { client } = setup();
    expect(client.websocketUrl()).toBe("wss://framateam.org/api/v4/websocket");
    expect(client.permalink("lov", "abc123")).toBe("https://framateam.org/lov/pl/abc123");
  });
});
