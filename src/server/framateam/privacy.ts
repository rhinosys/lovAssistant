import { MistralEmbeddingsProvider } from "../rag/vector/embeddings";
import { logger } from "../observability/logger";
import { FramateamClient } from "./client";
import { getFramateamSettings, isConfigured } from "./settings";
import { getFramateamStore, IFramateamStore } from "./store";
import { indexThreadPosts } from "./sync";
import { FramateamChannelRecord } from "./types";

export class InvalidPostReferenceError extends Error {
  constructor() {
    super("Référence de message invalide : indiquez un identifiant ou un permalien …/pl/<id>.");
    this.name = "InvalidPostReferenceError";
  }
}

export class ChannelNotFoundError extends Error {
  constructor(ref: string) {
    super(`Canal introuvable : ${ref}`);
    this.name = "ChannelNotFoundError";
  }
}

// Accepts a post id or a permalink such as https://framateam.org/lov/pl/<id>.
export const parsePostReference = (ref: string): string | null => {
  const trimmed = ref.trim();
  const fromLink = /\/pl\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/.exec(trimmed);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : null;
};

export type ThreadRebuilder = (rootPostId: string, channelId: string) => Promise<void>;

export interface ForgetPostResult {
  postId: string;
  rootPostId: string | null;
  threadRemoved: boolean;
  threadRebuilt: boolean;
}

// Tombstones the post (never indexed again), removes its thread from the index immediately,
// then rebuilds the thread without it when the post was a reply and Framateam is reachable.
export async function forgetPost(
  ref: string,
  { by, store = getFramateamStore(), rebuild }: { by: string; store?: IFramateamStore; rebuild?: ThreadRebuilder | null }
): Promise<ForgetPostResult> {
  const postId = parsePostReference(ref);
  if (!postId) throw new InvalidPostReferenceError();
  const thread = await store.findThreadOfPost(postId);
  await store.addForgotten({ postId, rootPostId: thread?.rootPostId ?? null, channelId: thread?.channelId ?? null, reason: "admin" });
  let threadRebuilt = false;
  if (thread) {
    await store.deleteThread(thread.rootPostId);
    if (thread.rootPostId !== postId && rebuild) {
      try {
        await rebuild(thread.rootPostId, thread.channelId);
        threadRebuilt = true;
      } catch (error) {
        logger.warn("Framateam thread rebuild after removal failed", { rootPostId: thread.rootPostId, error: String(error) });
      }
    }
  }
  logger.info("Framateam post removed from index", { by, postId, rootPostId: thread?.rootPostId ?? null, threadRebuilt });
  return { postId, rootPostId: thread?.rootPostId ?? null, threadRemoved: Boolean(thread), threadRebuilt };
}

export async function forgetChannel(
  ref: string,
  { by, store = getFramateamStore() }: { by: string; store?: IFramateamStore }
): Promise<{ channel: FramateamChannelRecord; removedChunks: number }> {
  const wanted = ref.trim().replace(/^~/, "");
  const channel = (await store.listChannels()).find((c) => c.channelId === wanted || c.name === wanted);
  if (!channel) throw new ChannelNotFoundError(ref);
  const removedChunks = await store.deleteChannelChunks(channel.channelId);
  await store.updateChannel(channel.channelId, { indexEnabled: false, initialDone: false, initialPage: 0, lastSyncMs: 0, lastSyncedAt: null, lastError: null, postsRead: 0, lastRunPosts: 0 });
  logger.info("Framateam channel removed from index", { by, channelId: channel.channelId, removedChunks });
  return { channel: { ...channel, indexEnabled: false }, removedChunks };
}

// Rebuilder backed by the live API, or null when Framateam is not configured.
export async function createThreadRebuilder(store: IFramateamStore = getFramateamStore()): Promise<ThreadRebuilder | null> {
  const settings = await getFramateamSettings(store);
  if (!isConfigured(settings)) return null;
  const client = new FramateamClient({ baseUrl: settings.baseUrl, loginId: settings.loginId, password: settings.password! });
  const embeddings = new MistralEmbeddingsProvider();
  return async (rootPostId, channelId) => {
    const channel = await store.getChannel(channelId);
    if (!channel?.indexEnabled) return;
    const thread = await client.getPostThread(rootPostId);
    await indexThreadPosts({ store, client, embeddings, settings }, channel, Object.values(thread.posts));
  };
}
