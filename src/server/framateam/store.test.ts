import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryFramateamStore, SyncBusyError } from "./store";
import { FramateamChunk } from "./types";

const chunk = (id: string, rootPostId: string, channelId = "c1", hash = "h1"): FramateamChunk => ({
  id, rootPostId, channelId, chunkIndex: 0, content: "texte", permalink: `https://framateam.org/lov/pl/${rootPostId}`,
  threadCreatedAt: new Date(0), threadUpdatedAt: new Date(0), contentHash: hash, postIds: [rootPostId], embedding: [1, 0],
});

describe("InMemoryFramateamStore", () => {
  let store: InMemoryFramateamStore;
  beforeEach(async () => {
    store = new InMemoryFramateamStore();
    await store.syncChannelList([
      { channelId: "c1", teamId: "t", name: "laser", displayName: "Laser" },
      { channelId: "c2", teamId: "t", name: "impression-3d", displayName: "Impression 3D" },
    ]);
  });

  it("inserts new channels disabled and reports channels no longer listed", async () => {
    const channels = await store.listChannels();
    expect(channels.map((c) => c.displayName)).toEqual(["Impression 3D", "Laser"]);
    expect(channels.every((c) => !c.indexEnabled && !c.listenEnabled)).toBe(true);

    await store.updateChannel("c1", { indexEnabled: true });
    const missing = await store.syncChannelList([{ channelId: "c1", teamId: "t", name: "laser", displayName: "Découpe laser" }]);
    expect(missing).toEqual(["c2"]);
    const c1 = await store.getChannel("c1");
    expect(c1?.indexEnabled).toBe(true);
    expect(c1?.displayName).toBe("Découpe laser");
  });

  it("replaces and deletes thread chunks, versioning changes", async () => {
    await store.updateChannel("c1", { indexEnabled: true });
    const v0 = await store.getChunksVersion();
    await store.replaceThreadChunks("r1", [chunk("r1#1", "r1"), chunk("r1#2", "r1")]);
    await store.replaceThreadChunks("r2", [chunk("r2#1", "r2")]);
    expect(await store.getChunksVersion()).not.toBe(v0);
    expect(await store.getThreadHash("r1")).toBe("h1");
    expect((await store.countThreadsByChannel()).get("c1")).toBe(2);

    await store.replaceThreadChunks("r1", [chunk("r1#1", "r1", "c1", "h2")]);
    expect((await store.listChunks()).filter((c) => c.rootPostId === "r1")).toHaveLength(1);
    expect(await store.deleteThread("r2")).toBe(1);
    expect(await store.deleteChannelChunks("c1")).toBe(1);
    expect(await store.listChunks()).toHaveLength(0);
  });

  it("hides chunks of channels whose indexing is disabled", async () => {
    await store.replaceThreadChunks("r1", [chunk("r1#1", "r1")]);
    expect(await store.listChunks()).toHaveLength(0);
  });

  it("records tombstones by post and root", async () => {
    await store.addForgotten({ postId: "p2", rootPostId: "r1", channelId: "c1", reason: "admin" });
    expect([...(await store.getForgottenIds(["p2", "p3"]))]).toEqual(["p2"]);
    expect([...(await store.getForgottenIds(["r1"]))]).toEqual(["p2"]);
  });

  it("refuses a concurrent sync", async () => {
    let release!: () => void;
    const first = store.withSyncLock(() => new Promise<void>((resolve) => { release = resolve; }));
    await expect(store.withSyncLock(async () => 1)).rejects.toBeInstanceOf(SyncBusyError);
    release();
    await first;
    await expect(store.withSyncLock(async () => 2)).resolves.toBe(2);
  });
});
