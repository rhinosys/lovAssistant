import { describe, expect, it, vi, afterEach } from "vitest";
import { EvidenceSource, renderEvidence, NO_EVIDENCE } from "./grounding";
import { YesWikiClient } from "../mcp/yeswiki-client";
const sources: EvidenceSource[] = [{ id: "S1", title: "Bambu Lab P1S", url: "https://example.org/p1s", origin: "DokuWiki", content: "La Bambu Lab P1S utilise Bambu Studio. Vérifiez sa disponibilité auprès du référent." }];
afterEach(() => vi.restoreAllMocks());
describe("verified factual answers", () => {
  it("renders only exact quotations with real source links", () => {
    const text = renderEvidence(JSON.stringify({ evidence: [{ sourceId: "S1", quote: "La Bambu Lab P1S utilise Bambu Studio." }], answer: "Prusa disponible" }), sources);
    expect(text).toContain("Bambu Lab P1S");
    expect(text).toContain("https://example.org/p1s");
    expect(text).not.toContain("Prusa");
    expect(text).toContain("ne confirme pas la disponibilité");
  });
  it.each([
    { sourceId: "S1", quote: "La Prusa MK3S+ est disponible." },
    { sourceId: "S99", quote: "La Bambu Lab P1S utilise Bambu Studio." },
    { sourceId: "S1", quote: "La Bambu Lab P1S est historique et indisponible." },
  ])("rejects invented quotes, links and unsupported status", item => {
    expect(renderEvidence(JSON.stringify({ evidence: [item] }), sources)).toBe(NO_EVIDENCE);
  });
  it("abstains on invalid or empty model output", () => {
    expect(renderEvidence("Voici la liste exhaustive : Prusa", sources)).toBe(NO_EVIDENCE);
    expect(renderEvidence('{"evidence":[]}', sources)).toBe(NO_EVIDENCE);
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
