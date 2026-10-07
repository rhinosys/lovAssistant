import { logger } from "../observability/logger";
import { ChatMessage } from "../model/types";
import { FramateamAuthError, FramateamClient } from "./client";
import { FramateamSettings, getFramateamSettings, isConfigured } from "./settings";
import { getFramateamStore, IFramateamStore, SyncBusyError } from "./store";
import { MattermostPost, MattermostUser } from "./types";

export type BotApi = Pick<
  FramateamClient,
  "login" | "currentUser" | "sessionToken" | "websocketUrl" | "getPostThread" | "getChannelPosts" | "addReaction" | "removeReaction" | "createPost"
>;

export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "close" | "error" | "message", listener: (event: { data?: unknown }) => void): void;
}

export interface BotDeps {
  store?: IFramateamStore;
  loadSettings?: (store: IFramateamStore) => Promise<FramateamSettings>;
  createClient?: (settings: FramateamSettings) => BotApi;
  createSocket?: (url: string) => WebSocketLike;
  answer: (input: { question: string; userHistory: ChatMessage[] }) => Promise<{ text: string }>;
  runSync?: () => Promise<unknown>;
  random?: () => number;
}

const PING_INTERVAL_MS = 30_000;
const SILENCE_TIMEOUT_MS = 90_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const IDLE_RETRY_MS = 60_000;
const CATCH_UP_WINDOW_MS = 15 * 60_000;
const MAX_PENDING = 3;
const MAX_MESSAGE_CHARS = 16_000;
const HISTORY_POSTS = 2;

export const ERROR_REPLY = "Désolé, je n’ai pas pu répondre à cause d’une erreur technique. Réessaie dans un moment ou consulte le wiki du LOV.";
export const BUSY_REPLY = "Je traite déjà plusieurs questions : réessaie dans un instant.";
export const EMPTY_REPLY = (trigger: string) => `Pose ta question après « ${trigger} », par exemple : ${trigger} quelle vitesse pour découper du contreplaqué de 3 mm ?`;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Returns the question when the post triggers the bot, null otherwise.
export function extractQuestion(message: string, settings: Pick<FramateamSettings, "triggerKeyword" | "acceptMentions">, me: MattermostUser): string | null {
  const text = message.trim();
  const keyword = new RegExp(`^${escapeRegExp(settings.triggerKeyword)}(?=\\s|$|[,:])`, "i");
  if (keyword.test(text)) return text.replace(keyword, "").replace(/^[\s,:]+/, "").trim();
  if (settings.acceptMentions) {
    const mention = new RegExp(`(^|\\s)@${escapeRegExp(me.username)}\\b`, "i");
    if (mention.test(text)) return text.replace(mention, " ").trim();
  }
  return null;
}

// Listens to the Framateam websocket and answers triggered questions in-thread.
export class FramateamBot {
  private readonly store: IFramateamStore;
  private readonly loadSettings: (store: IFramateamStore) => Promise<FramateamSettings>;
  private readonly createClient: (settings: FramateamSettings) => BotApi;
  private readonly createSocket: (url: string) => WebSocketLike;
  private readonly random: () => number;

  private settings: FramateamSettings | null = null;
  private client: BotApi | null = null;
  private me: MattermostUser | null = null;
  private socket: WebSocketLike | null = null;
  private listenChannels = new Set<string>();
  private seq = 1;
  private attempts = 0;
  private lastMessageAt = 0;
  private lastSeenPostAt = 0;
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => Promise<void>) | null = null;
  private handled = new Set<string>();
  private pending = 0;
  private channelQueues = new Map<string, Promise<void>>();

  constructor(private readonly deps: BotDeps) {
    this.store = deps.store ?? getFramateamStore();
    this.loadSettings = deps.loadSettings ?? getFramateamSettings;
    this.createClient = deps.createClient ?? ((s) => new FramateamClient({ baseUrl: s.baseUrl, loginId: s.loginId, password: s.password! }));
    this.createSocket = deps.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.random = deps.random ?? Math.random;
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.unsubscribe = await this.store.onConfigChanged(() => void this.reloadConfig());
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimers();
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
    this.closeSocket();
    await this.unsubscribe?.();
    this.unsubscribe = null;
  }

  // Waits for in-flight answers (tests, graceful shutdown).
  async idle(): Promise<void> {
    await Promise.all([...this.channelQueues.values()]);
  }

  private clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    try { socket?.close(); } catch { /* Already closed. */ }
  }

  private async refreshListenChannels() {
    this.listenChannels = new Set((await this.store.listChannels()).filter((c) => c.listenEnabled).map((c) => c.channelId));
  }

  private async reloadConfig() {
    if (this.stopped) return;
    try {
      const next = await this.loadSettings(this.store);
      await this.refreshListenChannels();
      const previous = this.settings;
      this.settings = next;
      const credentialsChanged = !previous || previous.baseUrl !== next.baseUrl || previous.loginId !== next.loginId || previous.password !== next.password;
      if (previous?.syncIntervalMin !== next.syncIntervalMin) this.scheduleSync();
      if (credentialsChanged) {
        logger.info("Framateam bot configuration changed, reconnecting");
        this.clearTimers();
        this.closeSocket();
        this.client = null;
        this.me = null;
        this.attempts = 0;
        await this.connect();
      }
    } catch (error) {
      logger.warn("Framateam bot configuration reload failed", { error: String(error) });
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    this.clearTimers();
    try {
      this.settings = await this.loadSettings(this.store);
      await this.refreshListenChannels();
      if (!isConfigured(this.settings)) {
        logger.info("Framateam bot idle: no account configured");
        this.reconnectTimer = setTimeout(() => void this.connect(), IDLE_RETRY_MS);
        return;
      }
      this.scheduleSync();
      this.client ??= this.createClient(this.settings);
      this.me = this.client.currentUser ?? (await this.client.login());
      this.openSocket(this.client);
    } catch (error) {
      logger.warn("Framateam bot connection failed", { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof FramateamAuthError) this.client = null;
      this.scheduleReconnect();
    }
  }

  private openSocket(client: BotApi) {
    const socket = this.createSocket(client.websocketUrl());
    this.socket = socket;
    this.lastMessageAt = Date.now();
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ seq: this.seq++, action: "authentication_challenge", data: { token: client.sessionToken } }));
    });
    socket.addEventListener("message", (event) => {
      if (socket !== this.socket) return;
      this.lastMessageAt = Date.now();
      void this.onMessage(String(event.data ?? ""));
    });
    socket.addEventListener("close", () => {
      if (socket !== this.socket) return;
      this.socket = null;
      logger.warn("Framateam websocket closed");
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => { /* A close event follows. */ });
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastMessageAt > SILENCE_TIMEOUT_MS) {
        logger.warn("Framateam websocket silent, reconnecting");
        this.closeSocket();
        this.scheduleReconnect();
        return;
      }
      try { socket.send(JSON.stringify({ seq: this.seq++, action: "ping" })); } catch { /* Close handler reconnects. */ }
    }, PING_INTERVAL_MS);
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    this.clearTimers();
    // Exponential backoff with jitter, capped, so a shared instance is never hammered.
    const base = Math.min(2000 * 2 ** this.attempts, MAX_BACKOFF_MS);
    const delay = Math.round(base / 2 + (base / 2) * this.random());
    this.attempts++;
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private scheduleSync() {
    if (!this.deps.runSync || !this.settings || this.stopped) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    const interval = this.settings.syncIntervalMin * 60_000;
    this.syncTimer = setTimeout(async () => {
      try {
        await this.deps.runSync!();
      } catch (error) {
        if (!(error instanceof SyncBusyError)) logger.warn("Scheduled Framateam sync failed", { error: error instanceof Error ? error.message : String(error) });
      }
      this.scheduleSync();
    }, interval);
  }

  private async onMessage(raw: string) {
    let message: { event?: string; data?: Record<string, unknown> };
    try { message = JSON.parse(raw); } catch { return; }
    if (message.event === "hello") {
      const wasReconnect = this.lastSeenPostAt > 0;
      this.attempts = 0;
      logger.info("Framateam websocket connected");
      if (wasReconnect) await this.catchUp();
      return;
    }
    if (message.event !== "posted" || typeof message.data?.post !== "string") return;
    let post: MattermostPost;
    try { post = JSON.parse(message.data.post); } catch { return; }
    this.lastSeenPostAt = Math.max(this.lastSeenPostAt, post.create_at || 0);
    this.consider(post, String(message.data.channel_type ?? ""));
  }

  // Triggers missed while disconnected (bounded window).
  private async catchUp() {
    if (!this.client) return;
    const since = Math.max(this.lastSeenPostAt, Date.now() - CATCH_UP_WINDOW_MS);
    for (const channelId of this.listenChannels) {
      try {
        const list = await this.client.getChannelPosts(channelId, { since });
        const posts = Object.values(list.posts ?? {}).filter((p) => p.create_at > since && !p.delete_at).sort((a, b) => a.create_at - b.create_at);
        // Posts returned for a listen-enabled channel come from a public channel (checked at enable time).
        for (const post of posts) this.consider(post, "O");
      } catch (error) {
        logger.warn("Framateam catch-up failed", { channelId, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  private consider(post: MattermostPost, channelType: string) {
    const settings = this.settings;
    const me = this.me;
    // Only public channels enabled by an admin; never DMs or private channels, never our own posts.
    if (!settings || !me || channelType !== "O" || !this.listenChannels.has(post.channel_id)) return;
    if (post.user_id === me.id || post.type || post.delete_at || this.handled.has(post.id)) return;
    const question = extractQuestion(post.message ?? "", settings, me);
    if (question === null) return;
    this.handled.add(post.id);
    if (this.handled.size > 1000) this.handled.delete(this.handled.values().next().value as string);

    if (this.pending >= MAX_PENDING) {
      void this.reply(post, BUSY_REPLY);
      return;
    }
    this.pending++;
    // One answer at a time per channel keeps replies ordered and the load low.
    const previous = this.channelQueues.get(post.channel_id) ?? Promise.resolve();
    const next = previous.then(() => this.answerPost(post, question)).finally(() => { this.pending--; });
    this.channelQueues.set(post.channel_id, next);
  }

  private async reply(post: MattermostPost, message: string) {
    try {
      await this.client!.createPost({ channel_id: post.channel_id, root_id: post.root_id || post.id, message: message.slice(0, MAX_MESSAGE_CHARS) });
    } catch (error) {
      logger.warn("Framateam reply failed", { postId: post.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async threadHistory(post: MattermostPost): Promise<ChatMessage[]> {
    if (!post.root_id || !this.client || !this.me) return [];
    const thread = await this.client.getPostThread(post.root_id);
    // Member messages only: assistant replies are never evidence.
    return Object.values(thread.posts ?? {})
      .filter((p) => p.id !== post.id && p.user_id !== this.me!.id && !p.type && !p.delete_at && p.create_at < post.create_at)
      .sort((a, b) => a.create_at - b.create_at)
      .slice(-HISTORY_POSTS)
      .map((p) => ({ role: "user" as const, content: (extractQuestion(p.message, this.settings!, this.me!) ?? p.message).slice(0, 1000) }));
  }

  private async answerPost(post: MattermostPost, question: string) {
    const client = this.client;
    if (!client || !this.settings) return;
    if (!question) {
      await this.reply(post, EMPTY_REPLY(this.settings.triggerKeyword));
      return;
    }
    const started = Date.now();
    await client.addReaction(post.id, "eyes").catch(() => undefined);
    try {
      const history = await this.threadHistory(post).catch(() => []);
      const result = await this.deps.answer({ question, userHistory: [...history, { role: "user", content: question }] });
      await this.reply(post, result.text);
      logger.info("Framateam question answered", { postId: post.id, channelId: post.channel_id, latencyMs: Date.now() - started });
    } catch (error) {
      logger.error("Framateam answer failed", { postId: post.id, error: error instanceof Error ? error.message : String(error) });
      await this.reply(post, ERROR_REPLY);
    } finally {
      await client.removeReaction(post.id, "eyes").catch(() => undefined);
    }
  }
}
