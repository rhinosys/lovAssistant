import { describe, expect, it, vi, afterEach } from "vitest";
import { EvidenceSource, renderEvidence, NO_EVIDENCE, webFallbackQuery, collectEvidence, evidencePrompt } from "./grounding";
import { YesWikiClient } from "../mcp/yeswiki-client";
import * as ragService from "../rag/retrieval/rag-service";
import { InMemoryFramateamStore, setFramateamStore } from "../framateam/store";
import { resetFramateamSearchCache } from "../framateam/search";
const sources: EvidenceSource[] = [{ id: "S1", title: "Bambu Lab P1S", url: "https://example.org/p1s", origin: "DokuWiki", content: "La Bambu Lab P1S utilise Bambu Studio. Vérifiez sa disponibilité auprès du référent." }];
afterEach(() => vi.restoreAllMocks());
describe("guided sourced answers", () => {
  it("allows helpful reformulation and Markdown with sources listed once", () => {
    const text = renderEvidence(JSON.stringify({ answer: "1. Ouvre **Bambu Studio**.\n2. Choisis la P1S.", sourceIds: ["S1", "S1"] }), sources);
    expect(text).toContain("1. Ouvre **Bambu Studio**.");
    expect(text.match(/https:\/\/example.org/g)).toHaveLength(1);
    expect(text).not.toContain("inventaire exhaustif");
  });
  it("rejects fabricated source references and generated URLs", () => {
    expect(renderEvidence(JSON.stringify({ answer: "Une procédure", sourceIds: ["S99"] }), sources)).toBe(NO_EVIDENCE);
    expect(renderEvidence(JSON.stringify({ answer: "Voir https://invented.example", sourceIds: ["S1"] }), sources)).toBe(NO_EVIDENCE);
  });
  it("keeps an image copied verbatim from a cited source, but drops an invented one", () => {
    const withImage: EvidenceSource[] = [{ id: "S1", title: "Laser Master 2 Pro S2", url: "https://example.org/laser", origin: "DokuWiki", content: "Allumer la barre d'alimentation.\n![Barre d'alimentation](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement:decoupe_laser:multiprise.jpg)" }];
    const kept = renderEvidence(JSON.stringify({ answer: "1. Allume la barre.\n![Barre d'alimentation](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement:decoupe_laser:multiprise.jpg)", sourceIds: ["S1"] }), withImage);
    expect(kept).toContain("![Barre d'alimentation](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement:decoupe_laser:multiprise.jpg)");

    const invented = renderEvidence(JSON.stringify({ answer: "1. Allume la barre.\n![Photo](https://evil.example/fake.jpg)", sourceIds: ["S1"] }), withImage);
    expect(invented).not.toContain("evil.example");
    expect(invented).not.toBe(NO_EVIDENCE);
  });
  it("keeps links pointing exactly to a source and infers citations from them in plain Markdown", () => {
    const threads: EvidenceSource[] = [
      { id: "S20", title: "Discussion Framateam ~couture (2024-11-03)", url: "https://framateam.org/labolov/pl/abc", origin: "Framateam", content: "machine à coudre" },
      { id: "S21", title: "Discussion Framateam ~couture (2024-05-01)", url: "https://framateam.org/labolov/pl/def", origin: "Framateam", content: "néoprène" },
    ];
    const plain = "Voici les discussions :\n- **2024-11-03** : aide machine ([lien](https://framateam.org/labolov/pl/abc)).\n- **2024-05-01** : astuce néoprène ([lien](<https://framateam.org/labolov/pl/def>)).";
    const rendered = renderEvidence(plain, threads);
    expect(rendered).toContain("([lien](<https://framateam.org/labolov/pl/abc>))");
    expect(rendered).toContain("([lien](<https://framateam.org/labolov/pl/def>))");
    expect(rendered).toContain("Sources : [Discussion Framateam ~couture (2024-11-03)](<https://framateam.org/labolov/pl/abc>) · [Discussion Framateam ~couture (2024-05-01)]");

    const json = renderEvidence(JSON.stringify({ answer: "Voir [ce fil](https://framateam.org/labolov/pl/abc).", sourceIds: ["S20"] }), threads);
    expect(json).toContain("[ce fil](<https://framateam.org/labolov/pl/abc>)");
  });
  it("still rejects any link to a URL that is not a source", () => {
    const threads: EvidenceSource[] = [{ id: "S1", title: "Fil", url: "https://framateam.org/labolov/pl/abc", origin: "Framateam", content: "x" }];
    expect(renderEvidence("Voir [fil](https://framateam.org/labolov/pl/abc) et [ici](https://evil.example)", threads)).toBe(NO_EVIDENCE);
    expect(renderEvidence(JSON.stringify({ answer: "Voir [fil](https://framateam.org/labolov/pl/abc-forged)", sourceIds: ["S1"] }), threads)).toBe(NO_EVIDENCE);
    expect(renderEvidence("Réponse sans aucune source vérifiée.", threads)).toBe(NO_EVIDENCE);
  });
  it("abstains on empty or malformed output", () => {
    expect(renderEvidence("Prusa", sources)).toBe(NO_EVIDENCE);
    expect(renderEvidence(JSON.stringify({ answer: "Prusa", sourceIds: [] }), sources)).toBe(NO_EVIDENCE);
  });
});
describe("wiki failures never create inventory", () => {
  it.each([new Response("Unavailable", { status: 503 }), new Response("<html>Not an API</html>", { status: 200 })])("returns no invented fixtures for a failing endpoint", async response => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    expect(await new YesWikiClient().getBazarEntries("machines")).toEqual([]);
  });
  it("does not default an unknown machine to available", async () => {
    const client = new YesWikiClient();
    vi.spyOn(client, "getBazarEntries").mockResolvedValue([]);
    expect(await client.getMachineStatus("Prusa")).toMatchObject({ status: "inconnu", materials: [], guideUrl: undefined });
  });
  it("does not invent the materials or status of a real entry", async () => {
    const client = new YesWikiClient();
    vi.spyOn(client, "getBazarEntries").mockResolvedValue([{ id: "real", title: "P1S", fields: {}, canonicalUrl: "https://example.org/p1s" }]);
    expect(await client.getMachineStatus("P1S")).toMatchObject({ status: "inconnu", materials: [] });
  });
});

describe("web fallback decision", () => {
  it("requires an explicit request and a usable query", () => {
    expect(webFallbackQuery(JSON.stringify({ needsWeb: true, webQuery: "manuel officiel procédure" }))).toBe("manuel officiel procédure");
    expect(webFallbackQuery(JSON.stringify({ needsWeb: false, webQuery: "manuel" }))).toBeNull();
    expect(webFallbackQuery("invalid")).toBeNull();
  });
});

describe("Framateam discussions as evidence", () => {
  const stubWikiAndRag = () => {
    vi.spyOn(YesWikiClient.prototype, "getPage").mockRejectedValue(new Error("offline"));
    vi.spyOn(YesWikiClient.prototype, "getBazarEntries").mockResolvedValue([]);
    const rag = { embedQuery: vi.fn().mockResolvedValue([1, 0]), search: vi.fn().mockResolvedValue([]) };
    vi.spyOn(ragService, "getRAGService").mockReturnValue(rag as unknown as ragService.RAGRetrievalService);
    return rag;
  };
  afterEach(() => { setFramateamStore(null); resetFramateamSearchCache(); });

  it("adds matching threads cited by permalink and shares the query embedding", async () => {
    const rag = stubWikiAndRag();
    const store = new InMemoryFramateamStore();
    await store.syncChannelList([{ channelId: "c", teamId: "t", name: "laser", displayName: "Laser" }]);
    await store.updateChannel("c", { indexEnabled: true });
    await store.replaceThreadChunks("root1", [{
      id: "root1#0", rootPostId: "root1", channelId: "c", chunkIndex: 0,
      content: "Discussion Framateam ~laser — 2024-03-05\n\n— contreplaqué 3 mm : 300 mm/min",
      permalink: "https://framateam.org/lov/pl/root1", threadCreatedAt: new Date(0), threadUpdatedAt: new Date(0), contentHash: "h", postIds: ["root1"], embedding: [1, 0],
    }]);
    setFramateamStore(store);

    const sources = await collectEvidence("vitesse contreplaqué");

    expect(rag.embedQuery).toHaveBeenCalledTimes(1);
    expect(rag.search).toHaveBeenCalledWith("vitesse contreplaqué", expect.objectContaining({ queryVector: [1, 0] }));
    expect(sources).toEqual([expect.objectContaining({ origin: "Framateam", title: "Discussion Framateam ~laser (2024-03-05)", url: "https://framateam.org/lov/pl/root1" })]);
    const rendered = renderEvidence(JSON.stringify({ answer: "D'après une discussion, 300 mm/min.", sourceIds: [sources[0].id] }), sources);
    expect(rendered).toContain("(<https://framateam.org/lov/pl/root1>)");
  });

  it("keeps the other sources when the Framateam index is unavailable", async () => {
    stubWikiAndRag();
    vi.spyOn(YesWikiClient.prototype, "getBazarEntries").mockResolvedValue([{ id: "k40", title: "K40", fields: { etat: "ok" }, canonicalUrl: "https://example.org/k40" }]);
    const broken = new InMemoryFramateamStore();
    broken.getChunksVersion = async () => { throw new Error("db down"); };
    setFramateamStore(broken);
    const sources = await collectEvidence("laser");
    expect(sources.map((s) => s.origin)).toEqual(["YesWiki"]);
  });

  it("tells the model that discussions rank below the wiki, especially for safety", () => {
    const prompt = evidencePrompt([]);
    expect(prompt).toContain("jamais des consignes officielles");
    expect(prompt).toContain("règle de sécurité");
  });
});
