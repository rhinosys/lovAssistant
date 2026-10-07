import { describe, it, expect, beforeEach, vi } from "vitest";
import { syncFramateam, SyncDeps } from "./sync";
import { InMemoryFramateamStore, SyncBusyError } from "./store";
import { FakeMattermost } from "./__fixtures__/fake-server";
import { post } from "./__fixtures__/api";
import { FramateamSettings } from "./settings";
import { EmbeddingsProvider } from "../rag/domain/types";

const settings: FramateamSettings = {
  source: "database", baseUrl: "https://framateam.org", teamName: "lov", loginId: "assistant-lov", password: "pw",
  passwordError: null, triggerKeyword: "!lov", acceptMentions: false, syncIntervalMin: 60,
};

const long = (text: string) => `${text} — ${"détails utiles sur le réglage de la machine ".repeat(4)}`;
const T0 = 1_700_000_000_000;

describe("syncFramateam", () => {
  let server: FakeMattermost;
  let store: InMemoryFramateamStore;
  let embeddings: EmbeddingsProvider & { embedDocuments: ReturnType<typeof vi.fn> };
  let deps: SyncDeps;

  beforeEach(async () => {
    server = new FakeMattermost();
    store = new InMemoryFramateamStore();
    embeddings = { dimension: 2, embedQuery: vi.fn(), embedDocuments: vi.fn(async (texts: string[]) => texts.map(() => [1, 0])) };
    deps = { store, client: server, embeddings, settings };
    server.add(
      post("a", { message: long("Quelle vitesse pour le CP 3 mm ?"), create_at: T0, update_at: T0 }),
      post("a1", { root_id: "a", message: long("300 mm/min à 100 %"), create_at: T0 + 10, update_at: T0 + 10 }),
      post("b", { message: long("Comment nettoyer la lentille ?"), create_at: T0 + 20, update_at: T0 + 20 }),
      post("c", { message: long("Le K40 ne s'allume plus"), create_at: T0 + 30, update_at: T0 + 30 }),
      post("p", { channel_id: "c_3d", message: long("Buse bouchée"), create_at: T0 + 40, update_at: T0 + 40 }),
    );
  });

  const enableLaser = async () => {
    await syncFramateam(deps); // discovers channels, all disabled
    await store.updateChannel("c_laser", { indexEnabled: true });
  };
  const rootsIndexed = async () => [...new Set((await store.listChunks()).map((c) => c.rootPostId))].sort();

  it("discovers channels disabled by default and fetches nothing from them", async () => {
    const report = await syncFramateam(deps);
    expect(report.channels).toHaveLength(0);
    expect((await store.listChannels()).every((c) => !c.indexEnabled)).toBe(true);
    expect(server.calls.some((c) => c.startsWith("page:") || c.startsWith("since:"))).toBe(false);
    expect((await store.listChannels()).map((c) => c.channelId)).not.toContain("c_private");
  });

  it("loads the full history of an enabled channel page by page", async () => {
    await enableLaser();
    const report = await syncFramateam(deps);
    expect(report.channels[0]).toMatchObject({ channelId: "c_laser", postsRead: 4, threadsIndexed: 3 });
    expect(await store.getChannel("c_laser")).toMatchObject({ postsRead: 4, lastRunPosts: 4 });
    expect(await rootsIndexed()).toEqual(["a", "b", "c"]);
    const channel = await store.getChannel("c_laser");
    expect(channel).toMatchObject({ initialDone: true, lastSyncMs: T0 + 30, lastError: null });
    const chunk = (await store.listChunks()).find((c) => c.rootPostId === "a")!;
    expect(chunk.permalink).toBe("https://framateam.org/lov/pl/a");
    expect(chunk.content).toContain("300 mm/min");
    expect(server.calls.filter((c) => c.startsWith("page:c_3d"))).toHaveLength(0);
  });

  it("resumes an interrupted initial load without duplicating threads", async () => {
    await enableLaser();
    server.failOnPage = 1;
    const first = await syncFramateam(deps);
    expect(first.channels[0].error).toContain("boom");
    // Progress of the first page is saved even though the load failed afterwards.
    expect(await store.getChannel("c_laser")).toMatchObject({ initialDone: false, initialPage: 1, postsRead: 2 });

    server.failOnPage = null;
    server.calls = [];
    await syncFramateam(deps);
    expect(server.calls).toContain("page:c_laser:1");
    expect(server.calls).not.toContain("page:c_laser:0");
    expect(await rootsIndexed()).toEqual(["a", "b", "c"]);
    expect((await store.listChunks()).filter((c) => c.rootPostId === "a")).toHaveLength(1);
  });

  it("re-indexes threads with new replies or edits and removes deleted ones", async () => {
    await enableLaser();
    await syncFramateam(deps);
    embeddings.embedDocuments.mockClear();

    server.add(post("b1", { root_id: "b", message: long("Alcool isopropylique et coton"), create_at: T0 + 100, update_at: T0 + 100 }));
    server.add({ ...server.posts.get("a1")!, message: long("Finalement 250 mm/min"), update_at: T0 + 110, edit_at: T0 + 110 });
    server.add({ ...server.posts.get("c")!, delete_at: T0 + 120, update_at: T0 + 120 });
    server.calls = [];
    const report = await syncFramateam(deps);

    expect(server.calls).toContain(`since:c_laser:${T0 + 30}`);
    expect(report.channels[0]).toMatchObject({ threadsIndexed: 2, threadsRemoved: 1 });
    // since: b1, a1, c ; threads re-read: a (a, a1) and b (b, b1) → 5 distinct posts.
    expect(report.channels[0].postsRead).toBe(5);
    expect(await store.getChannel("c_laser")).toMatchObject({ postsRead: 9, lastRunPosts: 5 });
    expect(await rootsIndexed()).toEqual(["a", "b"]);
    const chunks = await store.listChunks();
    expect(chunks.find((c) => c.rootPostId === "b")!.content).toContain("isopropylique");
    expect(chunks.find((c) => c.rootPostId === "a")!.content).toContain("250 mm/min");
    expect(chunks.find((c) => c.rootPostId === "a")!.content).not.toContain("300 mm/min");
    expect((await store.getChannel("c_laser"))!.lastSyncMs).toBe(T0 + 120);
  });

  it("removes a deleted reply from its thread", async () => {
    await enableLaser();
    await syncFramateam(deps);
    server.add({ ...server.posts.get("a1")!, delete_at: T0 + 200, update_at: T0 + 200 });
    await syncFramateam(deps);
    const a = (await store.listChunks()).find((c) => c.rootPostId === "a")!;
    expect(a.content).not.toContain("300 mm/min");
  });

  it("does not re-embed unchanged threads", async () => {
    await enableLaser();
    await syncFramateam(deps);
    embeddings.embedDocuments.mockClear();
    server.add({ ...server.posts.get("b")!, update_at: T0 + 300 }); // touched (e.g. reaction) but same text
    await syncFramateam(deps);
    expect(embeddings.embedDocuments).not.toHaveBeenCalled();
  });

  it("purges and disables a channel that is no longer public", async () => {
    await enableLaser();
    await syncFramateam(deps);
    server.channels.find((c) => c.id === "c_laser")!.type = "P";
    const report = await syncFramateam(deps);
    expect(report.purgedChannels).toBe(1);
    expect(await store.listChunks()).toHaveLength(0);
    expect(server.calls.filter((c) => c.includes("c_laser")).length).toBeGreaterThan(0);
    expect(await store.getChannel("c_laser")).toMatchObject({ indexEnabled: false });
  });

  it("purges a channel whose indexing was disabled", async () => {
    await enableLaser();
    await syncFramateam(deps);
    await store.updateChannel("c_laser", { indexEnabled: false });
    await syncFramateam(deps);
    expect(store.chunks.size).toBe(0);
  });

  it("refuses to run while another sync holds the lock", async () => {
    await expect(store.withSyncLock(() => syncFramateam(deps))).rejects.toBeInstanceOf(SyncBusyError);
  });
});
