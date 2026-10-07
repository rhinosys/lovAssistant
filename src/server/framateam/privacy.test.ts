import { describe, it, expect, beforeEach, vi } from "vitest";
import { forgetPost, forgetChannel, parsePostReference, InvalidPostReferenceError, ChannelNotFoundError } from "./privacy";
import { InMemoryFramateamStore } from "./store";
import { syncFramateam, indexThreadPosts, SyncDeps } from "./sync";
import { searchFramateamThreads, resetFramateamSearchCache } from "./search";
import { FakeMattermost } from "./__fixtures__/fake-server";
import { post } from "./__fixtures__/api";
import { FramateamSettings } from "./settings";

const settings: FramateamSettings = {
  source: "database", baseUrl: "https://framateam.org", teamName: "lov", loginId: "x", password: "pw",
  passwordError: null, triggerKeyword: "!lov", acceptMentions: false, syncIntervalMin: 60,
};
const long = (text: string) => `${text} — ${"détails utiles sur le réglage de la machine ".repeat(4)}`;

describe("GDPR controls", () => {
  let server: FakeMattermost;
  let store: InMemoryFramateamStore;
  let deps: SyncDeps;

  beforeEach(async () => {
    resetFramateamSearchCache();
    server = new FakeMattermost();
    store = new InMemoryFramateamStore();
    deps = { store, client: server, settings, embeddings: { dimension: 2, embedQuery: vi.fn(), embedDocuments: async (t: string[]) => t.map(() => [1, 0]) } };
    server.add(
      post("q", { message: long("Réglage de la découpe du médium"), create_at: 1, update_at: 1 }),
      post("secret", { root_id: "q", message: long("Mon numéro de téléphone pour en parler"), create_at: 2, update_at: 2 }),
      post("ok", { root_id: "q", message: long("Deux passes à 80 %"), create_at: 3, update_at: 3 }),
      post("other", { message: long("Nettoyage du plateau nid d'abeille"), create_at: 4, update_at: 4 }),
    );
    await syncFramateam(deps);
    await store.updateChannel("c_laser", { indexEnabled: true });
    await syncFramateam(deps);
  });

  const rebuild = async (rootPostId: string, channelId: string) => {
    const channel = (await store.getChannel(channelId))!;
    await indexThreadPosts(deps, channel, "u_bot", Object.values((await server.getPostThread(rootPostId)).posts));
  };
  const allText = async () => (await store.listChunks()).map((c) => c.content).join("\n");

  it("parses ids and permalinks", () => {
    expect(parsePostReference("https://framateam.org/lov/pl/abc123")).toBe("abc123");
    expect(parsePostReference(" abc123 ")).toBe("abc123");
    expect(parsePostReference("https://framateam.org/lov/channels/laser")).toBeNull();
  });

  it("removes a reply and rebuilds the thread without it", async () => {
    const result = await forgetPost("https://framateam.org/lov/pl/secret", { by: "admin", store, rebuild });
    expect(result).toMatchObject({ postId: "secret", rootPostId: "q", threadRemoved: true, threadRebuilt: true });
    expect(await allText()).not.toContain("téléphone");
    expect(await allText()).toContain("Deux passes");
  });

  it("removes the whole thread immediately when no rebuild is possible", async () => {
    await forgetPost("secret", { by: "admin", store, rebuild: null });
    expect(await allText()).not.toContain("médium");
    expect(await allText()).toContain("nid d'abeille");
  });

  it("removes a root post with its thread and never re-indexes it, even after a full reload", async () => {
    await forgetPost("q", { by: "admin", store, rebuild });
    expect(await allText()).not.toContain("médium");
    await forgetChannel("laser", { by: "admin", store });
    await store.updateChannel("c_laser", { indexEnabled: true });
    await syncFramateam(deps);
    expect(await allText()).not.toContain("médium");
    expect(await allText()).toContain("nid d'abeille");
  });

  it("keeps a removed reply out of the index after a full reload", async () => {
    await forgetPost("secret", { by: "admin", store, rebuild: null });
    await forgetChannel("c_laser", { by: "admin", store });
    await store.updateChannel("c_laser", { indexEnabled: true });
    await syncFramateam(deps);
    expect(await allText()).toContain("Deux passes");
    expect(await allText()).not.toContain("téléphone");
  });

  it("removes a channel, disables it and resets its sync state", async () => {
    const { removedChunks } = await forgetChannel("~laser", { by: "admin", store });
    expect(removedChunks).toBe(2);
    expect(store.chunks.size).toBe(0);
    expect(await store.getChannel("c_laser")).toMatchObject({ indexEnabled: false, initialDone: false, lastSyncMs: 0 });
    await expect(forgetChannel("inconnu", { by: "admin", store })).rejects.toBeInstanceOf(ChannelNotFoundError);
  });

  it("stops returning removed threads as evidence right away", async () => {
    expect((await searchFramateamThreads([1, 0], "médium", { store })).map((h) => h.rootPostId)).toContain("q");
    await forgetPost("q", { by: "admin", store });
    expect((await searchFramateamThreads([1, 0], "médium", { store })).map((h) => h.rootPostId)).not.toContain("q");
  });

  it("rejects invalid references", async () => {
    await expect(forgetPost("not a/valid ref", { by: "admin", store })).rejects.toBeInstanceOf(InvalidPostReferenceError);
  });
});
