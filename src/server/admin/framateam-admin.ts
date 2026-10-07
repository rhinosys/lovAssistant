import { z } from "zod";
import { logger } from "../observability/logger";
import { FramateamClient } from "../framateam/client";
import { getFramateamSettings, isConfigured, publicSettings, saveFramateamSettings } from "../framateam/settings";
import { getFramateamStore, SyncBusyError } from "../framateam/store";
import { FramateamNotConfiguredError, runFramateamSync, SyncReport } from "../framateam/sync";

export const settingsSchema = z.object({
  baseUrl: z.string().url().refine((url) => url.startsWith("https://"), "L'URL doit être en https"),
  teamName: z.string().trim().min(1, "Équipe requise").max(64),
  loginId: z.string().trim().min(1, "Identifiant requis").max(128),
  password: z.string().max(256).optional(),
  triggerKeyword: z.string().trim().min(2).max(32),
  acceptMentions: z.boolean(),
  syncIntervalMin: z.number().int().min(15).max(24 * 60),
});

export const channelPatchSchema = z.object({
  indexEnabled: z.boolean().optional(),
  listenEnabled: z.boolean().optional(),
});

export const forgetSchema = z.union([
  z.object({ post: z.string().trim().min(1).max(512) }),
  z.object({ channel: z.string().trim().min(1).max(128) }),
]);

export async function readSettings() {
  return publicSettings(await getFramateamSettings());
}

export async function writeSettings(input: z.infer<typeof settingsSchema>, by: string) {
  await saveFramateamSettings(input, by);
  logger.info("Framateam settings updated", { by, passwordChanged: Boolean(input.password) });
  return readSettings();
}

export async function connectedClient() {
  const settings = await getFramateamSettings();
  if (!isConfigured(settings)) throw new FramateamNotConfiguredError();
  const client = new FramateamClient({ baseUrl: settings.baseUrl, loginId: settings.loginId, password: settings.password! });
  return { client, settings };
}

export async function testConnection() {
  const { client, settings } = await connectedClient();
  const me = await client.login();
  const team = await client.getTeamByName(settings.teamName);
  return { username: me.username, team: team.display_name };
}

export async function listChannels({ refresh }: { refresh: boolean }) {
  const store = getFramateamStore();
  if (refresh) {
    const { client, settings } = await connectedClient();
    const team = await client.getTeamByName(settings.teamName);
    const channels = await client.listPublicChannels(team.id);
    await store.syncChannelList(channels.map((c) => ({ channelId: c.id, teamId: c.team_id, name: c.name, displayName: c.display_name })));
  }
  const counts = await store.countThreadsByChannel();
  return (await store.listChannels()).map((c) => ({
    channelId: c.channelId,
    name: c.name,
    displayName: c.displayName,
    indexEnabled: c.indexEnabled,
    listenEnabled: c.listenEnabled,
    initialDone: c.initialDone,
    lastSyncedAt: c.lastSyncedAt,
    lastError: c.lastError,
    postsRead: c.postsRead,
    lastRunPosts: c.lastRunPosts,
    threads: counts.get(c.channelId) ?? 0,
  }));
}

export async function updateChannel(channelId: string, patch: z.infer<typeof channelPatchSchema>, by: string) {
  const store = getFramateamStore();
  const channel = await store.getChannel(channelId);
  if (!channel) return null;
  await store.updateChannel(channelId, patch);
  // Disabling indexing removes the channel's content right away (GDPR), not at the next sync.
  if (patch.indexEnabled === false && channel.indexEnabled) {
    await store.deleteChannelChunks(channelId);
    await store.updateChannel(channelId, { initialDone: false, initialPage: 0, lastSyncMs: 0, postsRead: 0, lastRunPosts: 0 });
  }
  await store.notifyConfigChanged();
  logger.info("Framateam channel updated", { by, channelId, ...patch });
  return store.getChannel(channelId);
}

// Sync started from the admin runs inside the web process; its status is kept in memory here,
// while channel rows carry the persistent per-channel status.
type SyncJob = { running: boolean; startedAt: string | null; finishedAt: string | null; report: SyncReport | null; error: string | null };
let job: SyncJob = { running: false, startedAt: null, finishedAt: null, report: null, error: null };

// Also reports syncs started elsewhere (bot timer, CLI, another web worker).
export const syncStatus = async () => {
  const elsewhere = await getFramateamStore().isSyncRunning().catch(() => false);
  return { ...job, running: job.running || elsewhere };
};

export async function startSync(by: string, run: () => Promise<SyncReport> = () => runFramateamSync()) {
  if (job.running) throw new SyncBusyError();
  job = { running: true, startedAt: new Date().toISOString(), finishedAt: null, report: null, error: null };
  logger.info("Framateam sync started from admin", { by });
  const completion = run().then(
    (report) => { job = { ...job, running: false, finishedAt: new Date().toISOString(), report }; },
    (error) => {
      job = { ...job, running: false, finishedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
      throw error;
    }
  );
  // The lock is taken immediately: surface "busy" or configuration errors synchronously.
  const early = await Promise.race([completion.then(() => "done", (error) => error), new Promise((resolve) => setTimeout(() => resolve("pending"), 300))]);
  if (early instanceof Error) {
    if (early instanceof SyncBusyError || early instanceof FramateamNotConfiguredError) job = { running: false, startedAt: null, finishedAt: null, report: null, error: null };
    throw early;
  }
  void completion.catch(() => { /* Logged by the sync and kept in job.error. */ });
  return { ...job };
}
