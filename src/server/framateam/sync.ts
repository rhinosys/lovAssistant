import { EmbeddingsProvider } from "../rag/domain/types";
import { MistralEmbeddingsProvider } from "../rag/vector/embeddings";
import { getConfig } from "../config";
import { logger } from "../observability/logger";
import { FramateamClient } from "./client";
import { FramateamSettings, getFramateamSettings, isConfigured } from "./settings";
import { getFramateamStore, IFramateamStore } from "./store";
import { buildThreadDocuments } from "./thread-chunker";
import { FramateamChannelRecord, FramateamChunk, MattermostPost, MattermostPostList } from "./types";

export type FramateamApi = Pick<
  FramateamClient,
  "login" | "currentUser" | "getTeamByName" | "listPublicChannels" | "getChannelPosts" | "getPostThread" | "permalink"
>;

export interface SyncDeps {
  store: IFramateamStore;
  client: FramateamApi;
  embeddings: EmbeddingsProvider;
  settings: FramateamSettings;
  now?: () => number;
}

export interface ChannelSyncReport {
  channelId: string;
  name: string;
  postsRead: number;
  threadsIndexed: number;
  threadsRemoved: number;
  error?: string;
}

export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  channels: ChannelSyncReport[];
  purgedChannels: number;
}

export class FramateamNotConfiguredError extends Error {
  constructor() {
    super("Framateam n'est pas configuré (équipe, identifiant et mot de passe requis).");
    this.name = "FramateamNotConfiguredError";
  }
}

// Mattermost caps `since` responses; reaching it means some changes may be missing.
const SINCE_CAP = 1000;

const postsOf = (list: MattermostPostList): MattermostPost[] => Object.values(list.posts ?? {});
const listFromEnv = (value?: string) => new Set((value ?? "").split(",").map((name) => name.trim()).filter(Boolean));

class ChannelSync {
  indexed = 0;
  removed = 0;
  private readonly seen = new Set<string>();
  private maxUpdate: number;

  constructor(private readonly deps: SyncDeps, private readonly channel: FramateamChannelRecord) {
    this.maxUpdate = channel.lastSyncMs;
  }

  get postsRead(): number {
    return this.seen.size;
  }

  // Persisted after each page so the admin can follow a long initial load.
  private progress() {
    return { postsRead: this.channel.postsRead + this.seen.size, lastRunPosts: this.seen.size };
  }

  async run(): Promise<void> {
    const { store, client } = this.deps;
    if (!this.channel.initialDone) {
      // Pages are persisted one by one so that an interrupted load resumes where it stopped.
      for (let page = this.channel.initialPage; ; page++) {
        const list = await client.getChannelPosts(this.channel.channelId, { page });
        if (!list.order?.length) break;
        // Thread posts are included in `posts` (skipFetchThreads defaults to false).
        await this.processPosts(postsOf(list), false);
        await store.updateChannel(this.channel.channelId, { initialPage: page + 1, lastSyncMs: this.maxUpdate, ...this.progress() });
      }
    } else {
      const list = await client.getChannelPosts(this.channel.channelId, { since: this.channel.lastSyncMs });
      const changed = postsOf(list);
      if ((list.order?.length ?? 0) >= SINCE_CAP) changed.push(...(await this.pagesSince(this.channel.lastSyncMs)));
      await this.processPosts(changed, true);
    }
    await store.updateChannel(this.channel.channelId, {
      initialDone: true,
      lastSyncMs: this.maxUpdate,
      lastSyncedAt: new Date(this.deps.now?.() ?? Date.now()),
      lastError: null,
      ...this.progress(),
    });
  }

  private async pagesSince(since: number): Promise<MattermostPost[]> {
    const collected: MattermostPost[] = [];
    for (let page = 0; ; page++) {
      const list = await this.deps.client.getChannelPosts(this.channel.channelId, { page });
      const posts = postsOf(list);
      collected.push(...posts);
      if (!list.order?.length || posts.every((p) => p.create_at < since)) break;
    }
    return collected;
  }

  private async processPosts(posts: MattermostPost[], refetchThreads: boolean): Promise<void> {
    const byRoot = new Map<string, MattermostPost[]>();
    for (const post of posts) {
      this.seen.add(post.id);
      this.maxUpdate = Math.max(this.maxUpdate, post.update_at || 0, post.delete_at || 0);
      const rootId = post.root_id || post.id;
      if (!byRoot.has(rootId)) byRoot.set(rootId, []);
      byRoot.get(rootId)!.push(post);
    }
    for (const [rootId, inHand] of byRoot) {
      const root = inHand.find((p) => p.id === rootId);
      if (root && root.delete_at > 0) {
        this.removed += Number((await this.deps.store.deleteThread(rootId)) > 0);
        continue;
      }
      let threadPosts = inHand;
      if (refetchThreads || !root) {
        try {
          threadPosts = postsOf(await this.deps.client.getPostThread(rootId));
          for (const post of threadPosts) this.seen.add(post.id);
        } catch (error) {
          if ((error as { status?: number }).status === 404 || (error as { status?: number }).status === 403) {
            this.removed += Number((await this.deps.store.deleteThread(rootId)) > 0);
            continue;
          }
          throw error;
        }
      }
      await this.indexThread(threadPosts);
    }
  }

  private async indexThread(posts: MattermostPost[]): Promise<void> {
    const result = await indexThreadPosts(this.deps, this.channel, posts);
    this.indexed += result.indexed;
    this.removed += result.removed;
  }
}

// (Re)indexes one thread from its posts; unchanged threads are not re-embedded.
export async function indexThreadPosts(
  deps: Pick<SyncDeps, "store" | "client" | "embeddings" | "settings">,
  channel: Pick<FramateamChannelRecord, "channelId" | "name">,
  posts: MattermostPost[]
): Promise<{ indexed: number; removed: number }> {
  const { store, client, embeddings, settings } = deps;
  let indexed = 0;
  let removed = 0;
  const forgottenIds = await store.getForgottenIds(posts.map((p) => p.id));
  const { documents, discardedRoots } = buildThreadDocuments(posts, {
    channelName: channel.name,
    forgottenIds,
    permalink: (rootId) => client.permalink(settings.teamName, rootId),
  });
  for (const rootId of discardedRoots) removed += Number((await store.deleteThread(rootId)) > 0);
  for (const doc of documents) {
    if ((await store.getThreadHash(doc.rootPostId)) === doc.contentHash) continue;
    const vectors = await embeddings.embedDocuments(doc.chunks.map((c) => c.content));
    const chunks: FramateamChunk[] = doc.chunks.map((c, i) => ({
      id: `${doc.rootPostId}#${c.index}`,
      rootPostId: doc.rootPostId,
      channelId: channel.channelId,
      chunkIndex: c.index,
      content: c.content,
      permalink: doc.permalink,
      threadCreatedAt: doc.createdAt,
      threadUpdatedAt: doc.updatedAt,
      contentHash: doc.contentHash,
      postIds: doc.postIds,
      embedding: vectors[i] ?? null,
    }));
    await store.replaceThreadChunks(doc.rootPostId, chunks);
    indexed++;
  }
  return { indexed, removed };
}

// Synchronises the enabled public channels. Only one sync runs at a time (across processes).
export async function syncFramateam(deps: SyncDeps, options: { channelIds?: string[] } = {}): Promise<SyncReport> {
  const { store, client, settings } = deps;
  if (!isConfigured(settings)) throw new FramateamNotConfiguredError();
  return store.withSyncLock(async () => {
    const startedAt = new Date().toISOString();
    if (!client.currentUser) await client.login();
    const team = await client.getTeamByName(settings.teamName);
    const apiChannels = await client.listPublicChannels(team.id);
    const vanished = await store.syncChannelList(apiChannels.map((c) => ({
      channelId: c.id, teamId: c.team_id, name: c.name, displayName: c.display_name,
    })));

    // Channels archived, deleted or turned private are purged and disabled.
    let purgedChannels = 0;
    for (const channelId of vanished) {
      purgedChannels += Number((await store.deleteChannelChunks(channelId)) > 0);
      await store.updateChannel(channelId, { indexEnabled: false, listenEnabled: false, initialDone: false, initialPage: 0, lastSyncMs: 0 });
    }

    if (settings.source === "env") {
      const config = getConfig();
      const toIndex = listFromEnv(config.FRAMATEAM_INDEX_CHANNELS);
      const toListen = listFromEnv(config.FRAMATEAM_LISTEN_CHANNELS);
      for (const c of apiChannels) {
        if (toIndex.has(c.name) || toListen.has(c.name)) {
          await store.updateChannel(c.id, { ...(toIndex.has(c.name) ? { indexEnabled: true } : {}), ...(toListen.has(c.name) ? { listenEnabled: true } : {}) });
        }
      }
    }

    const counts = await store.countThreadsByChannel();
    const reports: ChannelSyncReport[] = [];
    for (const channel of await store.listChannels()) {
      if (vanished.includes(channel.channelId)) continue;
      if (!channel.indexEnabled) {
        if (counts.get(channel.channelId)) purgedChannels += Number((await store.deleteChannelChunks(channel.channelId)) > 0);
        continue;
      }
      if (options.channelIds && !options.channelIds.includes(channel.channelId)) continue;
      const sync = new ChannelSync(deps, channel);
      try {
        await sync.run();
        reports.push({ channelId: channel.channelId, name: channel.name, postsRead: sync.postsRead, threadsIndexed: sync.indexed, threadsRemoved: sync.removed });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Framateam channel sync failed", { channel: channel.name, error: message });
        await store.updateChannel(channel.channelId, { lastError: message.slice(0, 500) });
        if (sync.postsRead) await store.updateChannel(channel.channelId, { postsRead: channel.postsRead + sync.postsRead, lastRunPosts: sync.postsRead });
        reports.push({ channelId: channel.channelId, name: channel.name, postsRead: sync.postsRead, threadsIndexed: sync.indexed, threadsRemoved: sync.removed, error: message });
      }
    }
    const report = { startedAt, finishedAt: new Date().toISOString(), channels: reports, purgedChannels };
    logger.info("Framateam sync completed", {
      channels: reports.length,
      postsRead: reports.reduce((n, r) => n + r.postsRead, 0),
      indexed: reports.reduce((n, r) => n + r.threadsIndexed, 0),
      removed: reports.reduce((n, r) => n + r.threadsRemoved, 0),
      failures: reports.filter((r) => r.error).length,
    });
    return report;
  });
}

// Wires the real client, store and embeddings from the active settings.
export async function runFramateamSync(options: { channelIds?: string[]; client?: FramateamClient } = {}): Promise<SyncReport> {
  const store = getFramateamStore();
  const settings = await getFramateamSettings(store);
  if (!isConfigured(settings)) throw new FramateamNotConfiguredError();
  const client = options.client ?? new FramateamClient({ baseUrl: settings.baseUrl, loginId: settings.loginId, password: settings.password! });
  return syncFramateam({ store, client, embeddings: new MistralEmbeddingsProvider(), settings }, options);
}
