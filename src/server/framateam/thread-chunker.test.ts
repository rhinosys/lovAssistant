import { describe, it, expect } from "vitest";
import { buildThreadDocuments, normalizeMessage } from "./thread-chunker";
import { post } from "./__fixtures__/api";

const options = {
  channelName: "laser",
  selfUserId: "u_bot",
  forgottenIds: new Set<string>(),
  permalink: (id: string) => `https://framateam.org/lov/pl/${id}`,
};

const question = post("root", { user_id: "u_alice", message: "@bob quelle puissance pour couper du contreplaqué de 3 mm sur la Laser Master 2 Pro ?", create_at: 1_700_000_000_000 });
const answer = post("r1", { root_id: "root", user_id: "u_bob", message: "Avec le module 10 W, 2 passes à 100 % et 300 mm/min fonctionnent bien. Pense à l'air assist.", create_at: 1_700_000_100_000, update_at: 1_700_000_200_000 });

describe("thread chunker", () => {
  it("builds one anonymised document per thread with permalink and metadata", () => {
    const { documents } = buildThreadDocuments([answer, question], options);
    expect(documents).toHaveLength(1);
    const doc = documents[0];
    expect(doc.rootPostId).toBe("root");
    expect(doc.permalink).toBe("https://framateam.org/lov/pl/root");
    expect(doc.createdAt.toISOString().slice(0, 10)).toBe("2023-11-14");
    expect(doc.updatedAt.getTime()).toBe(1_700_000_200_000);
    expect(doc.chunks).toHaveLength(1);
    const text = doc.chunks[0].content;
    expect(text).toContain("Discussion Framateam ~laser — 2023-11-14");
    expect(text.indexOf("quelle puissance")).toBeLessThan(text.indexOf("2 passes"));
    for (const identity of ["bob", "alice", "u_alice", "u_bob"]) expect(text).not.toContain(identity);
    expect(text).toContain("@membre");
  });

  it("drops system, deleted, own and forgotten posts, and pure acknowledgements", () => {
    const posts = [
      question, answer,
      post("sys", { root_id: "root", type: "system_join_channel", message: "alice a rejoint le canal" }),
      post("del", { root_id: "root", delete_at: 1, message: "message supprimé confidentiel" }),
      post("bot", { root_id: "root", user_id: "u_bot", message: "Réponse générée par l'assistant à ne pas réindexer" }),
      post("forg", { root_id: "root", message: "message retiré à la demande de son auteur" }),
      post("thx", { root_id: "root", message: "Merci ! :+1:" }),
    ];
    const { documents } = buildThreadDocuments(posts, { ...options, forgottenIds: new Set(["forg"]) });
    const text = documents[0].chunks[0].content;
    for (const hidden of ["rejoint", "confidentiel", "assistant", "retiré", "Merci"]) expect(text).not.toContain(hidden);
  });

  it("discards short threads, deleted or forgotten roots and threads without their root", () => {
    const short = post("short", { message: "Qui est là ce soir ?" });
    const deletedRoot = post("dr", { delete_at: 5, message: "x".repeat(300) });
    const orphan = post("reply", { root_id: "missing", message: "y".repeat(300) });
    const forgotten = post("fr", { message: "z ".repeat(200) });
    const { documents, discardedRoots } = buildThreadDocuments([short, deletedRoot, orphan, forgotten], { ...options, forgottenIds: new Set(["fr"]) });
    expect(documents).toHaveLength(0);
    expect(discardedRoots.sort()).toEqual(["dr", "fr", "missing", "short"]);
  });

  it("splits long threads, each chunk restating the root question", () => {
    const replies = Array.from({ length: 12 }, (_, i) => post(`r${i}`, { root_id: "root", create_at: 1_700_000_000_000 + i + 1, message: `Réponse numéro ${i} : ${"réglage détaillé ".repeat(20)}` }));
    const { documents } = buildThreadDocuments([question, ...replies], options);
    const chunks = documents[0].chunks;
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content).toContain("Question initiale : @membre quelle puissance");
      expect(chunk.content.length).toBeLessThanOrEqual(1800);
    }
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it("produces a stable hash that changes when content changes", () => {
    const a = buildThreadDocuments([question, answer], options).documents[0].contentHash;
    const b = buildThreadDocuments([answer, question], options).documents[0].contentHash;
    const c = buildThreadDocuments([question, { ...answer, message: "Finalement 3 passes." + " Avec air assist obligatoire.".repeat(3) }], options).documents[0].contentHash;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("normalises mentions without touching e-mail addresses", () => {
    expect(normalizeMessage("Salut @alice.dupont et @bob_42, écris à contact@lov.fr ~laser")).toBe("Salut @membre et @membre, écris à contact@lov.fr laser");
  });
});
