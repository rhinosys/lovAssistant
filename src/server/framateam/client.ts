import { logger } from "../observability/logger";
import { MattermostChannel, MattermostPost, MattermostPostList, MattermostTeam, MattermostUser } from "./types";

export class FramateamApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly errorId?: string) {
    super(message);
    this.name = "FramateamApiError";
  }
}

export class FramateamAuthError extends FramateamApiError {
  constructor(message = "Identifiants Framateam refusés.", status = 401, errorId?: string) {
    super(message, status, errorId);
    this.name = "FramateamAuthError";
  }
}

export class FramateamMfaRequiredError extends FramateamAuthError {
  constructor() {
    super("Ce compte Framateam exige une double authentification : utilisez un compte dédié sans MFA.", 401, "mfa");
    this.name = "FramateamMfaRequiredError";
  }
}

export interface FramateamCredentials {
  baseUrl: string;
  loginId: string;
  password: string;
}

export interface FramateamClientDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  // Minimum delay between two requests to the shared instance.
  minSpacingMs?: number;
  maxAttempts?: number;
  timeoutMs?: number;
}

type RequestOptions = { body?: unknown; auth?: boolean };

const PER_PAGE = 200;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Mattermost API v4 client for a regular user account (no bot, no personal access token).
// All calls are serialised and spaced; 401 triggers one re-login, 429/5xx back off.
export class FramateamClient {
  readonly baseUrl: string;
  private token: string | null = null;
  private me: MattermostUser | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly minSpacingMs: number;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(private readonly credentials: FramateamCredentials, deps: FramateamClientDeps = {}) {
    this.baseUrl = credentials.baseUrl.replace(/\/$/, "");
    this.fetchImpl = deps.fetch ?? fetch;
    this.sleep = deps.sleep ?? defaultSleep;
    this.now = deps.now ?? Date.now;
    this.minSpacingMs = deps.minSpacingMs ?? 250;
    this.maxAttempts = deps.maxAttempts ?? 5;
    this.timeoutMs = deps.timeoutMs ?? 20_000;
  }

  get sessionToken(): string | null {
    return this.token;
  }

  get currentUser(): MattermostUser | null {
    return this.me;
  }

  websocketUrl(): string {
    return `${this.baseUrl.replace(/^http/, "ws")}/api/v4/websocket`;
  }

  permalink(teamName: string, postId: string): string {
    return `${this.baseUrl}/${teamName}/pl/${postId}`;
  }

  login(): Promise<MattermostUser> {
    return this.schedule(() => this.doLogin());
  }

  getMe(): Promise<MattermostUser> {
    return this.call<MattermostUser>("GET", "/users/me");
  }

  getTeamByName(name: string): Promise<MattermostTeam> {
    return this.call<MattermostTeam>("GET", `/teams/name/${encodeURIComponent(name)}`);
  }

  // Public (type "O"), non-archived channels only.
  async listPublicChannels(teamId: string): Promise<MattermostChannel[]> {
    const channels: MattermostChannel[] = [];
    for (let page = 0; ; page++) {
      const batch = await this.call<MattermostChannel[]>("GET", `/teams/${teamId}/channels?page=${page}&per_page=${PER_PAGE}`);
      channels.push(...batch);
      if (batch.length < PER_PAGE) break;
    }
    return channels.filter((c) => c.type === "O" && !c.delete_at);
  }

  getChannelPosts(channelId: string, query: { page: number; perPage?: number } | { since: number }): Promise<MattermostPostList> {
    const params = "since" in query
      ? `since=${query.since}`
      : `page=${query.page}&per_page=${query.perPage ?? PER_PAGE}`;
    return this.call<MattermostPostList>("GET", `/channels/${channelId}/posts?${params}`);
  }

  getPostThread(postId: string): Promise<MattermostPostList> {
    return this.call<MattermostPostList>("GET", `/posts/${postId}/thread`);
  }

  getPost(postId: string): Promise<MattermostPost> {
    return this.call<MattermostPost>("GET", `/posts/${postId}`);
  }

  createPost(post: { channel_id: string; message: string; root_id?: string }): Promise<MattermostPost> {
    return this.call<MattermostPost>("POST", "/posts", { body: post });
  }

  async addReaction(postId: string, emojiName: string): Promise<void> {
    const me = await this.ensureMe();
    await this.call("POST", "/reactions", { body: { user_id: me.id, post_id: postId, emoji_name: emojiName } });
  }

  async removeReaction(postId: string, emojiName: string): Promise<void> {
    const me = await this.ensureMe();
    await this.call("DELETE", `/users/${me.id}/posts/${postId}/reactions/${encodeURIComponent(emojiName)}`);
  }

  private async ensureMe(): Promise<MattermostUser> {
    // The login response already carries the user; avoid an extra request.
    if (!this.me) {
      if (!this.token) await this.login();
      else this.me = await this.getMe();
    }
    return this.me!;
  }

  private call<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    return this.schedule(() => this.execute<T>(method, path, options));
  }

  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async spacedFetch(url: string, init: RequestInit): Promise<Response> {
    const wait = this.lastRequestAt + this.minSpacingMs - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();
    return this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
  }

  private async doLogin(): Promise<MattermostUser> {
    this.token = null;
    const response = await this.withRetries(() => this.spacedFetch(`${this.baseUrl}/api/v4/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "AdminLova-Framateam/1.0" },
      body: JSON.stringify({ login_id: this.credentials.loginId, password: this.credentials.password }),
    }));
    if (!response.ok) {
      const body = await readJson(response);
      const errorId = typeof body?.id === "string" ? body.id : undefined;
      if (errorId?.includes("mfa")) throw new FramateamMfaRequiredError();
      if (response.status === 401 || response.status === 403) throw new FramateamAuthError(undefined, response.status, errorId);
      throw new FramateamApiError(`Connexion Framateam impossible (HTTP ${response.status})`, response.status, errorId);
    }
    const token = response.headers.get("Token");
    if (!token) throw new FramateamAuthError("Framateam n'a renvoyé aucun jeton de session.");
    this.token = token;
    this.me = (await response.json()) as MattermostUser;
    logger.info("Framateam login succeeded", { username: this.me.username });
    return this.me;
  }

  private async execute<T>(method: string, path: string, { body, auth = true }: RequestOptions): Promise<T> {
    let relogged = false;
    for (;;) {
      if (auth && !this.token) await this.doLogin();
      const response = await this.withRetries(() => this.spacedFetch(`${this.baseUrl}/api/v4${path}`, {
        method,
        headers: {
          "User-Agent": "AdminLova-Framateam/1.0",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(auth && this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }));
      if (response.status === 401 && auth && !relogged) {
        // Session expired or revoked: log in once more and replay the request.
        relogged = true;
        this.token = null;
        continue;
      }
      if (!response.ok) {
        const error = await readJson(response);
        const message = typeof error?.message === "string" ? error.message : `HTTP ${response.status}`;
        if (response.status === 401) throw new FramateamAuthError(`Session Framateam refusée : ${message}`, 401, error?.id);
        throw new FramateamApiError(`Framateam ${method} ${path.split("?")[0]} : ${message}`, response.status, error?.id);
      }
      if (response.status === 204) return undefined as T;
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
  }

  // Retries rate limits (429), server errors (5xx) and network failures with backoff.
  private async withRetries(send: () => Promise<Response>): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      let response: Response | null = null;
      let failure: unknown = null;
      try {
        response = await send();
      } catch (error) {
        failure = error;
      }
      const retryable = failure !== null || response!.status === 429 || response!.status >= 500;
      if (!retryable) return response!;
      if (attempt >= this.maxAttempts) {
        if (response) return response;
        throw new FramateamApiError(`Framateam injoignable : ${String(failure)}`, 0);
      }
      const delay = response?.status === 429 ? rateLimitDelay(response) : Math.min(1000 * 2 ** (attempt - 1), 60_000);
      logger.warn("Framateam request retry", { status: response?.status ?? "network", attempt, delayMs: delay });
      await this.sleep(delay);
    }
  }
}

const readJson = async (response: Response): Promise<{ id?: string; message?: string } | null> => {
  try { return (await response.json()) as { id?: string; message?: string }; } catch { return null; }
};

// Retry-After is in seconds; Mattermost's X-Ratelimit-Reset is the number of seconds until reset.
const rateLimitDelay = (response: Response): number => {
  const header = response.headers.get("Retry-After") ?? response.headers.get("X-Ratelimit-Reset");
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 10 * 60_000) : 30_000;
};
