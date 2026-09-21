import { describe, expect, it, vi, afterEach } from "vitest";
import { EvidenceSource, renderEvidence, NO_EVIDENCE, webFallbackQuery } from "./grounding";
import { YesWikiClient } from "../mcp/yeswiki-client";
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
