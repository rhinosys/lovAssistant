import { FramateamApiError } from "../client";
import { FramateamApi } from "../sync";
import { MattermostChannel, MattermostPost, MattermostPostList } from "../types";
import { CHANNELS, ME, TEAM, postList } from "./api";

// In-memory Mattermost implementing the subset of the API used by the sync.
export class FakeMattermost implements FramateamApi {
  channels: MattermostChannel[] = CHANNELS.map((c) => ({ ...c }));
  posts = new Map<string, MattermostPost>();
  calls: string[] = [];
  perPage = 2;
  failOnPage: number | null = null;
  currentUser = ME;

  add(...posts: MattermostPost[]) {
    for (const post of posts) this.posts.set(post.id, { ...post });
  }

  async login() { this.calls.push("login"); return ME; }
  async getTeamByName() { this.calls.push("team"); return TEAM; }
  async listPublicChannels() {
    this.calls.push("channels");
    return this.channels.filter((c) => c.type === "O" && !c.delete_at);
  }
  permalink(team: string, id: string) { return `https://framateam.org/${team}/pl/${id}`; }

  private thread(rootId: string) {
    return [...this.posts.values()].filter((p) => p.id === rootId || p.root_id === rootId);
  }

  async getChannelPosts(channelId: string, query: { page: number } | { since: number }): Promise<MattermostPostList> {
    if (this.channels.find((c) => c.id === channelId)?.type !== "O") throw new Error(`private channel ${channelId} fetched`);
    this.calls.push("since" in query ? `since:${channelId}:${query.since}` : `page:${channelId}:${query.page}`);
    const all = [...this.posts.values()].filter((p) => p.channel_id === channelId);
    if ("since" in query) return postList(all.filter((p) => Math.max(p.update_at, p.delete_at) > query.since));
    if (this.failOnPage === query.page) throw new FramateamApiError("boom", 500);
    const visible = all.filter((p) => !p.delete_at).sort((a, b) => b.create_at - a.create_at);
    const page = visible.slice(query.page * this.perPage, (query.page + 1) * this.perPage);
    const list = postList(page);
    // Like Mattermost (skipFetchThreads=false), whole threads are included in `posts`.
    for (const post of page) for (const p of this.thread(post.root_id || post.id)) if (!p.delete_at) list.posts[p.id] = p;
    return list;
  }

  async getPostThread(postId: string): Promise<MattermostPostList> {
    this.calls.push(`thread:${postId}`);
    const root = this.posts.get(postId);
    if (!root || root.delete_at) throw new FramateamApiError("not found", 404);
    return postList(this.thread(postId).filter((p) => !p.delete_at));
  }
}
