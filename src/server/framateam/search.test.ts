import { describe, it, expect, beforeEach } from "vitest";
import { searchFramateamThreads, resetFramateamSearchCache } from "./search";
import { InMemoryFramateamStore } from "./store";
import { FramateamChunk } from "./types";

const chunk = (rootPostId: string, chunkIndex: number, content: string, embedding: number[]): FramateamChunk => ({
  id: `${rootPostId}#${chunkIndex}`, rootPostId, channelId: "c_laser", chunkIndex, content,
  permalink: `https://framateam.org/lov/pl/${rootPostId}`, threadCreatedAt: new Date(0), threadUpdatedAt: new Date(0),
  contentHash: "h", postIds: [rootPostId], embedding,
});

describe("searchFramateamThreads", () => {
  let store: InMemoryFramateamStore;
  beforeEach(async () => {
    resetFramateamSearchCache();
    store = new InMemoryFramateamStore();
    await store.syncChannelList([{ channelId: "c_laser", teamId: "t", name: "laser", displayName: "Laser" }]);
    await store.updateChannel("c_laser", { indexEnabled: true });
    await store.replaceThreadChunks("a", [
      chunk("a", 0, "Discussion Framateam ~laser — 2024-03-05\n\nQuestion initiale : vitesse contreplaqué\n\n— 300 mm/min", [1, 0]),
      chunk("a", 1, "Discussion Framateam ~laser — 2024-03-05\n\nQuestion initiale : vitesse contreplaqué\n\n— air assist conseillé", [0.9, 0.1]),
    ]);
    await store.replaceThreadChunks("b", [chunk("b", 0, "Discussion Framateam ~laser — 2024-01-01\n\n— horaires du local", [0, 1])]);
  });

  it("returns whole threads ranked by their best chunk, with title and permalink", async () => {
    const hits = await searchFramateamThreads([1, 0], "vitesse contreplaqué", { store });
    expect(hits[0]).toMatchObject({ rootPostId: "a", title: "Discussion Framateam ~laser (2024-03-05)", permalink: "https://framateam.org/lov/pl/a" });
    expect(hits[0].content).toContain("300 mm/min");
    expect(hits[0].content).toContain("air assist");
    expect(hits[0].content.match(/Question initiale/g)).toHaveLength(1);
    expect(hits.map((h) => h.rootPostId)).not.toContain("b");
  });

  it("falls back to keywords without a query vector and sees removals immediately", async () => {
    expect((await searchFramateamThreads([], "horaires local", { store, minScore: 0.05 }))[0].rootPostId).toBe("b");
    await store.deleteThread("b");
    expect(await searchFramateamThreads([], "horaires local", { store, minScore: 0.05 })).toHaveLength(0);
  });

  it("ignores channels whose indexing is disabled", async () => {
    await store.updateChannel("c_laser", { indexEnabled: false });
    expect(await searchFramateamThreads([1, 0], "vitesse", { store })).toHaveLength(0);
  });
});
