import { MattermostChannel, MattermostPost, MattermostPostList } from "../types";

export const ME = { id: "u_bot", username: "assistant-lov" };
export const TEAM = { id: "t_lov", name: "lov", display_name: "LOV" };

export const CHANNELS: MattermostChannel[] = [
  { id: "c_laser", team_id: "t_lov", name: "laser", display_name: "Découpe laser", type: "O", delete_at: 0 },
  { id: "c_3d", team_id: "t_lov", name: "impression-3d", display_name: "Impression 3D", type: "O", delete_at: 0 },
  { id: "c_archived", team_id: "t_lov", name: "old", display_name: "Ancien", type: "O", delete_at: 1700000000000 },
  { id: "c_private", team_id: "t_lov", name: "bureau", display_name: "Bureau", type: "P", delete_at: 0 },
];

export const post = (id: string, overrides: Partial<MattermostPost> = {}): MattermostPost => ({
  id,
  channel_id: "c_laser",
  user_id: "u_alice",
  root_id: "",
  message: `message ${id}`,
  type: "",
  create_at: 1_700_000_000_000,
  update_at: 1_700_000_000_000,
  delete_at: 0,
  ...overrides,
});

export const postList = (posts: MattermostPost[]): MattermostPostList => ({
  order: [...posts].sort((a, b) => b.create_at - a.create_at).map((p) => p.id),
  posts: Object.fromEntries(posts.map((p) => [p.id, p])),
});

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });

export const loginResponse = (token = "tok-1") => json(ME, { headers: { Token: token } });
