import crypto from "node:crypto";
import { MattermostPost } from "./types";

export interface ThreadChunkText {
  index: number;
  content: string;
}

export interface ThreadDocument {
  rootPostId: string;
  channelId: string;
  permalink: string;
  createdAt: Date;
  updatedAt: Date;
  contentHash: string;
  postIds: string[];
  chunks: ThreadChunkText[];
}

export interface ThreadBuildOptions {
  channelName: string;
  selfUserId: string | null;
  forgottenIds: Set<string>;
  permalink: (rootPostId: string) => string;
  // Minimum useful characters for a thread to be indexed.
  minChars?: number;
  maxTokens?: number;
}

export interface ThreadBuildResult {
  documents: ThreadDocument[];
  // Roots that must not (or no longer) be indexed: deleted, forgotten or without useful content.
  discardedRoots: string[];
}

const ROOT_PREFIX_CHARS = 600;
const USELESS = /^(merci|merci beaucoup|ok|okay|top|super|cool|parfait|génial|genial|d'accord|daccord|oui|non|\+1|bravo|yes|nickel)$/i;

// Removes identities from message text: @mentions become a neutral placeholder.
export const normalizeMessage = (message: string): string =>
  message
    .replace(/(^|[^\w@.\/])@[a-z0-9][a-z0-9._-]*/gi, "$1@membre")
    .replace(/(^|\s)~([a-z0-9][a-z0-9_-]*)/gi, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const usefulText = (text: string): string =>
  text
    .replace(/:[a-z0-9_+-]+:/gi, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/@membre/g, "")
    .replace(/[\s!?.,;:()]+/g, " ")
    .trim();

const isUseful = (text: string): boolean => {
  const core = usefulText(text);
  return core.length >= 15 || (core.length > 0 && !USELESS.test(core) && core.split(" ").length >= 3);
};

const splitLong = (text: string, maxChars: number): string[] => {
  const parts: string[] = [];
  for (let start = 0; start < text.length; start += maxChars) parts.push(text.slice(start, start + maxChars));
  return parts;
};

// One document per thread (root + replies, chronological), never containing author names.
export function buildThreadDocuments(posts: MattermostPost[], options: ThreadBuildOptions): ThreadBuildResult {
  const minChars = options.minChars ?? 120;
  const maxChars = (options.maxTokens ?? 450) * 4;
  const threads = new Map<string, MattermostPost[]>();
  for (const post of posts) {
    const rootId = post.root_id || post.id;
    if (!threads.has(rootId)) threads.set(rootId, []);
    const list = threads.get(rootId)!;
    if (!list.some((p) => p.id === post.id)) list.push(post);
  }

  const documents: ThreadDocument[] = [];
  const discardedRoots: string[] = [];
  for (const [rootId, threadPosts] of threads) {
    const root = threadPosts.find((p) => p.id === rootId);
    if (!root || root.delete_at > 0 || options.forgottenIds.has(rootId)) {
      discardedRoots.push(rootId);
      continue;
    }
    const kept = threadPosts
      .filter((p) => p.delete_at === 0 && !p.type && p.user_id !== options.selfUserId && !options.forgottenIds.has(p.id))
      .sort((a, b) => a.create_at - b.create_at)
      .map((p) => ({ post: p, text: normalizeMessage(p.message) }))
      .filter(({ post, text }) => text && (post.id === rootId || isUseful(text)));

    const rootEntry = kept.find(({ post }) => post.id === rootId);
    const usefulChars = kept.reduce((sum, { text }) => sum + usefulText(text).length, 0);
    if (!rootEntry || usefulChars < minChars) {
      discardedRoots.push(rootId);
      continue;
    }

    const date = new Date(root.create_at).toISOString().slice(0, 10);
    const header = `Discussion Framateam ~${options.channelName} — ${date}`;
    const lines = kept.map(({ text }) => `— ${text}`);
    const fullText = `${header}\n\n${lines.join("\n\n")}`;

    const chunks: ThreadChunkText[] = [];
    if (fullText.length <= maxChars) {
      chunks.push({ index: 0, content: fullText });
    } else {
      // Every chunk restates the question so that replies remain understandable on their own.
      const rootText = rootEntry.text.length > ROOT_PREFIX_CHARS ? `${rootEntry.text.slice(0, ROOT_PREFIX_CHARS)}…` : rootEntry.text;
      const prefix = `${header}\n\nQuestion initiale : ${rootText}\n\n`;
      const budget = Math.max(maxChars - prefix.length, 400);
      const pieces = lines.flatMap((line) => (line.length > budget ? splitLong(line, budget) : [line]));
      let current: string[] = [];
      let size = 0;
      const flush = () => {
        if (current.length) chunks.push({ index: chunks.length, content: `${prefix}${current.join("\n\n")}` });
        current = [];
        size = 0;
      };
      for (const piece of pieces) {
        if (size + piece.length > budget) flush();
        current.push(piece);
        size += piece.length + 2;
      }
      flush();
    }

    documents.push({
      rootPostId: rootId,
      channelId: root.channel_id,
      permalink: options.permalink(rootId),
      createdAt: new Date(root.create_at),
      updatedAt: new Date(Math.max(...kept.map(({ post }) => post.update_at || post.create_at))),
      contentHash: crypto.createHash("sha256").update(fullText).digest("hex"),
      postIds: kept.map(({ post }) => post.id),
      chunks,
    });
  }
  return { documents, discardedRoots };
}
