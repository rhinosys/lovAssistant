import { computeCosineSimilarity } from "../rag/vector/embeddings";
import { computeKeywordScore, hybridScore, tokenizeQuery } from "../rag/vector/vector-store";
import { getFramateamStore, IFramateamStore } from "./store";
import { FramateamChunk } from "./types";

export interface FramateamThreadHit {
  rootPostId: string;
  title: string;
  permalink: string;
  content: string;
  score: number;
}

export interface FramateamSearchOptions {
  topK?: number;
  minScore?: number;
  maxChars?: number;
  store?: IFramateamStore;
}

// Chunks are reloaded only when the index changes (sync, GDPR removal).
let cache: { store: IFramateamStore; version: string; chunks: FramateamChunk[] } | null = null;

const loadChunks = async (store: IFramateamStore): Promise<FramateamChunk[]> => {
  const version = await store.getChunksVersion();
  if (!cache || cache.store !== store || cache.version !== version) {
    cache = { store, version, chunks: await store.listChunks() };
  }
  return cache.chunks;
};

export const resetFramateamSearchCache = () => { cache = null; };

// "Discussion Framateam ~laser — 2024-03-05" → "Discussion ~laser (2024-03-05)"
const titleOf = (chunk: FramateamChunk): string => {
  const match = /^Discussion Framateam ~(\S+) — (\d{4}-\d{2}-\d{2})/.exec(chunk.content);
  return match ? `Discussion Framateam ~${match[1]} (${match[2]})` : "Discussion Framateam";
};

// Most relevant indexed threads, returned whole (bounded) so that answers keep the context of replies.
export async function searchFramateamThreads(
  queryVector: number[],
  queryText: string,
  { topK = 4, minScore = 0.2, maxChars = 6000, store = getFramateamStore() }: FramateamSearchOptions = {}
): Promise<FramateamThreadHit[]> {
  const chunks = await loadChunks(store);
  if (!chunks.length) return [];
  const words = tokenizeQuery(queryText);
  const best = new Map<string, number>();
  for (const chunk of chunks) {
    const vectorScore = queryVector.length && chunk.embedding?.length ? computeCosineSimilarity(queryVector, chunk.embedding) : 0;
    const score = hybridScore(vectorScore, words.length ? computeKeywordScore(words, chunk.content, "") : 0);
    if (score >= minScore && score > (best.get(chunk.rootPostId) ?? 0)) best.set(chunk.rootPostId, score);
  }
  return [...best]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([rootPostId, score]) => {
      const parts = chunks.filter((c) => c.rootPostId === rootPostId).sort((a, b) => a.chunkIndex - b.chunkIndex);
      // Later chunks repeat the root question: keep only their replies.
      const text = parts
        .map((c, i) => (i === 0 ? c.content : c.content.split("\n\n").slice(2).join("\n\n")))
        .join("\n\n");
      return { rootPostId, title: titleOf(parts[0]), permalink: parts[0].permalink, content: text.slice(0, maxChars), score };
    });
}
