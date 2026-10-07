// Subset of the Mattermost API v4 payloads used by the integration.
export interface MattermostUser {
  id: string;
  username: string;
}

export interface MattermostTeam {
  id: string;
  name: string;
  display_name: string;
}

export interface MattermostChannel {
  id: string;
  team_id: string;
  name: string;
  display_name: string;
  // "O" public, "P" private, "D" direct, "G" group
  type: string;
  delete_at?: number;
}

export interface MattermostPost {
  id: string;
  channel_id: string;
  user_id: string;
  root_id: string;
  message: string;
  // Empty for regular messages, e.g. "system_join_channel" otherwise
  type: string;
  create_at: number;
  update_at: number;
  edit_at?: number;
  delete_at: number;
  props?: Record<string, unknown>;
}

export interface MattermostPostList {
  order: string[];
  posts: Record<string, MattermostPost>;
  next_post_id?: string;
  prev_post_id?: string;
}

// Persisted state
export interface FramateamSettingsRecord {
  baseUrl: string;
  teamName: string;
  loginId: string;
  passwordEnc: string | null;
  triggerKeyword: string;
  acceptMentions: boolean;
  syncIntervalMin: number;
  updatedBy?: string | null;
  updatedAt?: Date;
}

export interface FramateamChannelRecord {
  channelId: string;
  teamId: string;
  name: string;
  displayName: string;
  indexEnabled: boolean;
  listenEnabled: boolean;
  initialPage: number;
  initialDone: boolean;
  lastSyncMs: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
  // Posts read from the API: since the channel was enabled, and during the last sync.
  postsRead: number;
  lastRunPosts: number;
}

export type ChannelPatch = Partial<Omit<FramateamChannelRecord, "channelId" | "teamId">>;

export interface FramateamChunk {
  id: string;
  rootPostId: string;
  channelId: string;
  chunkIndex: number;
  content: string;
  permalink: string;
  threadCreatedAt: Date;
  threadUpdatedAt: Date;
  contentHash: string;
  postIds: string[];
  embedding: number[] | null;
}

export interface ForgottenPost {
  postId: string;
  rootPostId: string | null;
  channelId: string | null;
  reason: string;
}
