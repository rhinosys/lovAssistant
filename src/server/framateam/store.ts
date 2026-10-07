import pg from "pg";
import { getDbPool } from "../persistence/db";
import { isForceInMemory } from "../persistence";
import {
  ChannelPatch,
  FramateamChannelRecord,
  FramateamChunk,
  FramateamSettingsRecord,
  ForgottenPost,
} from "./types";

export class SyncBusyError extends Error {
  constructor() {
    super("Une synchronisation Framateam est déjà en cours.");
    this.name = "SyncBusyError";
  }
}

export interface ApiChannelInfo {
  channelId: string;
  teamId: string;
  name: string;
  displayName: string;
}

export interface IFramateamStore {
  getSettings(): Promise<FramateamSettingsRecord | null>;
  saveSettings(settings: FramateamSettingsRecord): Promise<void>;

  listChannels(): Promise<FramateamChannelRecord[]>;
  getChannel(channelId: string): Promise<FramateamChannelRecord | null>;
  // Inserts unknown channels disabled, refreshes names; returns ids no longer listed by the API.
  syncChannelList(channels: ApiChannelInfo[]): Promise<string[]>;
  updateChannel(channelId: string, patch: ChannelPatch): Promise<void>;
  countThreadsByChannel(): Promise<Map<string, number>>;

  getThreadHash(rootPostId: string): Promise<string | null>;
  // Root of the indexed thread containing this post (root or reply), if any.
  findThreadOfPost(postId: string): Promise<{ rootPostId: string; channelId: string } | null>;
  replaceThreadChunks(rootPostId: string, chunks: FramateamChunk[]): Promise<void>;
  deleteThread(rootPostId: string): Promise<number>;
  deleteChannelChunks(channelId: string): Promise<number>;
  // Cache key changing whenever chunks change.
  getChunksVersion(): Promise<string>;
  listChunks(): Promise<FramateamChunk[]>;

  addForgotten(entry: ForgottenPost): Promise<void>;
  getForgottenIds(postIds: string[]): Promise<Set<string>>;

  // Runs fn only if no other sync holds the lock (across processes for Postgres).
  withSyncLock<T>(fn: () => Promise<T>): Promise<T>;
  // True while any process (web, CLI, bot) holds the sync lock.
  isSyncRunning(): Promise<boolean>;

  // Cross-process signal: admin saved settings or channel flags.
  notifyConfigChanged(): Promise<void>;
  // Returns an unsubscribe function.
  onConfigChanged(listener: () => void): Promise<() => Promise<void>>;
}

const CONFIG_CHANNEL = "framateam_config";

const SYNC_LOCK_KEY = 74_210_001;

type ChannelRow = {
  channel_id: string; team_id: string; name: string; display_name: string;
  index_enabled: boolean; listen_enabled: boolean; initial_page: number; initial_done: boolean;
  last_sync_ms: string; last_synced_at: Date | null; last_error: string | null;
  posts_read: string; last_run_posts: number;
};

const toChannel = (row: ChannelRow): FramateamChannelRecord => ({
  channelId: row.channel_id,
  teamId: row.team_id,
  name: row.name,
  displayName: row.display_name,
  indexEnabled: row.index_enabled,
  listenEnabled: row.listen_enabled,
  initialPage: row.initial_page,
  initialDone: row.initial_done,
  lastSyncMs: Number(row.last_sync_ms),
  lastSyncedAt: row.last_synced_at,
  lastError: row.last_error,
  postsRead: Number(row.posts_read ?? 0),
  lastRunPosts: row.last_run_posts ?? 0,
});

const channelColumns: Record<keyof ChannelPatch, string> = {
  name: "name",
  displayName: "display_name",
  indexEnabled: "index_enabled",
  listenEnabled: "listen_enabled",
  initialPage: "initial_page",
  initialDone: "initial_done",
  lastSyncMs: "last_sync_ms",
  lastSyncedAt: "last_synced_at",
  lastError: "last_error",
  postsRead: "posts_read",
  lastRunPosts: "last_run_posts",
};

export class PgFramateamStore implements IFramateamStore {
  constructor(private readonly pool: pg.Pool = getDbPool()) {}

  async getSettings(): Promise<FramateamSettingsRecord | null> {
    const { rows } = await this.pool.query("SELECT * FROM framateam_settings WHERE id = 1");
    const row = rows[0];
    if (!row) return null;
    return {
      baseUrl: row.base_url,
      teamName: row.team_name,
      loginId: row.login_id,
      passwordEnc: row.password_enc,
      triggerKeyword: row.trigger_keyword,
      acceptMentions: row.accept_mentions,
      syncIntervalMin: row.sync_interval_min,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    };
  }

  async saveSettings(s: FramateamSettingsRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO framateam_settings (id, base_url, team_name, login_id, password_enc, trigger_keyword, accept_mentions, sync_interval_min, updated_by, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET base_url = $1, team_name = $2, login_id = $3, password_enc = $4,
         trigger_keyword = $5, accept_mentions = $6, sync_interval_min = $7, updated_by = $8, updated_at = NOW()`,
      [s.baseUrl, s.teamName, s.loginId, s.passwordEnc, s.triggerKeyword, s.acceptMentions, s.syncIntervalMin, s.updatedBy ?? null]
    );
  }

  async listChannels(): Promise<FramateamChannelRecord[]> {
    const { rows } = await this.pool.query<ChannelRow>("SELECT * FROM framateam_channels ORDER BY display_name ASC");
    return rows.map(toChannel);
  }

  async getChannel(channelId: string): Promise<FramateamChannelRecord | null> {
    const { rows } = await this.pool.query<ChannelRow>("SELECT * FROM framateam_channels WHERE channel_id = $1", [channelId]);
    return rows[0] ? toChannel(rows[0]) : null;
  }

  async syncChannelList(channels: ApiChannelInfo[]): Promise<string[]> {
    for (const c of channels) {
      await this.pool.query(
        `INSERT INTO framateam_channels (channel_id, team_id, name, display_name) VALUES ($1, $2, $3, $4)
         ON CONFLICT (channel_id) DO UPDATE SET name = $3, display_name = $4, updated_at = NOW()`,
        [c.channelId, c.teamId, c.name, c.displayName]
      );
    }
    const { rows } = await this.pool.query<{ channel_id: string }>(
      "SELECT channel_id FROM framateam_channels WHERE NOT (channel_id = ANY($1::text[]))",
      [channels.map((c) => c.channelId)]
    );
    return rows.map((row) => row.channel_id);
  }

  async updateChannel(channelId: string, patch: ChannelPatch): Promise<void> {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [keyof ChannelPatch, unknown][];
    if (!entries.length) return;
    const sets = entries.map(([key], i) => `${channelColumns[key]} = $${i + 2}`);
    await this.pool.query(
      `UPDATE framateam_channels SET ${sets.join(", ")}, updated_at = NOW() WHERE channel_id = $1`,
      [channelId, ...entries.map(([, value]) => value)]
    );
  }

  async countThreadsByChannel(): Promise<Map<string, number>> {
    const { rows } = await this.pool.query<{ channel_id: string; threads: string }>(
      "SELECT channel_id, COUNT(DISTINCT root_post_id) AS threads FROM framateam_chunks GROUP BY channel_id"
    );
    return new Map(rows.map((row) => [row.channel_id, Number(row.threads)]));
  }

  async getThreadHash(rootPostId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ content_hash: string }>(
      "SELECT content_hash FROM framateam_chunks WHERE root_post_id = $1 LIMIT 1",
      [rootPostId]
    );
    return rows[0]?.content_hash ?? null;
  }

  async findThreadOfPost(postId: string): Promise<{ rootPostId: string; channelId: string } | null> {
    const { rows } = await this.pool.query<{ root_post_id: string; channel_id: string }>(
      "SELECT root_post_id, channel_id FROM framateam_chunks WHERE root_post_id = $1 OR post_ids @> ARRAY[$1]::text[] LIMIT 1",
      [postId]
    );
    return rows[0] ? { rootPostId: rows[0].root_post_id, channelId: rows[0].channel_id } : null;
  }

  async replaceThreadChunks(rootPostId: string, chunks: FramateamChunk[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM framateam_chunks WHERE root_post_id = $1", [rootPostId]);
      for (const c of chunks) {
        await client.query(
          `INSERT INTO framateam_chunks (id, root_post_id, channel_id, chunk_index, content, permalink, thread_created_at, thread_updated_at, content_hash, post_ids, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [c.id, c.rootPostId, c.channelId, c.chunkIndex, c.content, c.permalink, c.threadCreatedAt, c.threadUpdatedAt, c.contentHash, c.postIds, c.embedding]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteThread(rootPostId: string): Promise<number> {
    const result = await this.pool.query("DELETE FROM framateam_chunks WHERE root_post_id = $1", [rootPostId]);
    return result.rowCount ?? 0;
  }

  async deleteChannelChunks(channelId: string): Promise<number> {
    const result = await this.pool.query("DELETE FROM framateam_chunks WHERE channel_id = $1", [channelId]);
    return result.rowCount ?? 0;
  }

  async getChunksVersion(): Promise<string> {
    const { rows } = await this.pool.query<{ n: string; latest: Date | null }>(
      "SELECT COUNT(*) AS n, MAX(updated_at) AS latest FROM framateam_chunks"
    );
    return `${rows[0].n}:${rows[0].latest?.toISOString() ?? ""}`;
  }

  async listChunks(): Promise<FramateamChunk[]> {
    const { rows } = await this.pool.query(
      `SELECT c.* FROM framateam_chunks c JOIN framateam_channels ch ON ch.channel_id = c.channel_id WHERE ch.index_enabled`
    );
    return rows.map((row) => ({
      id: row.id,
      rootPostId: row.root_post_id,
      channelId: row.channel_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      permalink: row.permalink,
      threadCreatedAt: row.thread_created_at,
      threadUpdatedAt: row.thread_updated_at,
      contentHash: row.content_hash,
      postIds: row.post_ids ?? [],
      embedding: row.embedding,
    }));
  }

  async addForgotten(entry: ForgottenPost): Promise<void> {
    await this.pool.query(
      `INSERT INTO framateam_forgotten (post_id, root_post_id, channel_id, reason) VALUES ($1, $2, $3, $4)
       ON CONFLICT (post_id) DO NOTHING`,
      [entry.postId, entry.rootPostId, entry.channelId, entry.reason]
    );
  }

  async getForgottenIds(postIds: string[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    const { rows } = await this.pool.query<{ post_id: string }>(
      "SELECT post_id FROM framateam_forgotten WHERE post_id = ANY($1::text[]) OR root_post_id = ANY($1::text[])",
      [postIds]
    );
    return new Set(rows.map((row) => row.post_id));
  }

  async withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
    // Advisory locks are per session: keep one client for lock and unlock.
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [SYNC_LOCK_KEY]);
      if (!rows[0].locked) throw new SyncBusyError();
      try {
        return await fn();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [SYNC_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }

  async isSyncRunning(): Promise<boolean> {
    const { rows } = await this.pool.query(
      "SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 0 AND objid = $1 AND granted LIMIT 1",
      [SYNC_LOCK_KEY]
    );
    return rows.length > 0;
  }

  async notifyConfigChanged(): Promise<void> {
    await this.pool.query("SELECT pg_notify($1, '')", [CONFIG_CHANNEL]);
  }

  async onConfigChanged(listener: () => void): Promise<() => Promise<void>> {
    const client = await this.pool.connect();
    const handler = (message: pg.Notification) => { if (message.channel === CONFIG_CHANNEL) listener(); };
    client.on("notification", handler);
    await client.query(`LISTEN ${CONFIG_CHANNEL}`);
    return async () => {
      client.off("notification", handler);
      try { await client.query(`UNLISTEN ${CONFIG_CHANNEL}`); } finally { client.release(); }
    };
  }
}

export class InMemoryFramateamStore implements IFramateamStore {
  settings: FramateamSettingsRecord | null = null;
  channels = new Map<string, FramateamChannelRecord>();
  chunks = new Map<string, FramateamChunk>();
  forgotten = new Map<string, ForgottenPost>();
  private version = 0;
  private locked = false;

  async getSettings() { return this.settings ? { ...this.settings } : null; }
  async saveSettings(settings: FramateamSettingsRecord) { this.settings = { ...settings, updatedAt: new Date() }; }

  async listChannels() {
    return [...this.channels.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((c) => ({ ...c }));
  }
  async getChannel(channelId: string) {
    const channel = this.channels.get(channelId);
    return channel ? { ...channel } : null;
  }
  async syncChannelList(channels: ApiChannelInfo[]) {
    for (const c of channels) {
      const existing = this.channels.get(c.channelId);
      this.channels.set(c.channelId, existing
        ? { ...existing, name: c.name, displayName: c.displayName }
        : { ...c, indexEnabled: false, listenEnabled: false, initialPage: 0, initialDone: false, lastSyncMs: 0, lastSyncedAt: null, lastError: null, postsRead: 0, lastRunPosts: 0 });
    }
    const listed = new Set(channels.map((c) => c.channelId));
    return [...this.channels.keys()].filter((id) => !listed.has(id));
  }
  async updateChannel(channelId: string, patch: ChannelPatch) {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    this.channels.set(channelId, { ...channel, ...defined });
  }
  async countThreadsByChannel() {
    const roots = new Map<string, Set<string>>();
    for (const c of this.chunks.values()) {
      if (!roots.has(c.channelId)) roots.set(c.channelId, new Set());
      roots.get(c.channelId)!.add(c.rootPostId);
    }
    return new Map([...roots].map(([id, set]) => [id, set.size]));
  }

  async getThreadHash(rootPostId: string) {
    return [...this.chunks.values()].find((c) => c.rootPostId === rootPostId)?.contentHash ?? null;
  }
  async findThreadOfPost(postId: string) {
    const chunk = [...this.chunks.values()].find((c) => c.rootPostId === postId || c.postIds.includes(postId));
    return chunk ? { rootPostId: chunk.rootPostId, channelId: chunk.channelId } : null;
  }
  async replaceThreadChunks(rootPostId: string, chunks: FramateamChunk[]) {
    await this.deleteThread(rootPostId);
    for (const c of chunks) this.chunks.set(c.id, { ...c });
    this.version++;
  }
  async deleteThread(rootPostId: string) {
    return this.deleteWhere((c) => c.rootPostId === rootPostId);
  }
  async deleteChannelChunks(channelId: string) {
    return this.deleteWhere((c) => c.channelId === channelId);
  }
  private deleteWhere(predicate: (chunk: FramateamChunk) => boolean) {
    let removed = 0;
    for (const [id, chunk] of this.chunks) if (predicate(chunk)) { this.chunks.delete(id); removed++; }
    if (removed) this.version++;
    return removed;
  }
  async getChunksVersion() { return `${this.chunks.size}:${this.version}`; }
  async listChunks() {
    return [...this.chunks.values()].filter((c) => this.channels.get(c.channelId)?.indexEnabled).map((c) => ({ ...c }));
  }

  async addForgotten(entry: ForgottenPost) {
    if (!this.forgotten.has(entry.postId)) this.forgotten.set(entry.postId, { ...entry });
  }
  async getForgottenIds(postIds: string[]) {
    const wanted = new Set(postIds);
    return new Set([...this.forgotten.values()]
      .filter((f) => wanted.has(f.postId) || (f.rootPostId !== null && wanted.has(f.rootPostId)))
      .map((f) => f.postId));
  }

  async withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.locked) throw new SyncBusyError();
    this.locked = true;
    try { return await fn(); } finally { this.locked = false; }
  }

  async isSyncRunning() { return this.locked; }

  private listeners = new Set<() => void>();
  async notifyConfigChanged() { for (const listener of this.listeners) listener(); }
  async onConfigChanged(listener: () => void) {
    this.listeners.add(listener);
    return async () => { this.listeners.delete(listener); };
  }
}

let storeInstance: IFramateamStore | null = null;

export function getFramateamStore(): IFramateamStore {
  if (!storeInstance) storeInstance = isForceInMemory() ? new InMemoryFramateamStore() : new PgFramateamStore();
  return storeInstance;
}

export function setFramateamStore(store: IFramateamStore | null): void {
  storeInstance = store;
}
