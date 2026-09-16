import { describe, it, expect } from "vitest";
import { chunkMarkdownDocument } from "./text-chunker";
import { DokuWikiDocument } from "../domain/types";

describe("Semantic Text Chunker", () => {
  const sampleDoc: DokuWikiDocument = {
    id: "equipement:test",
    title: "Machine de Test",
    namespace: "equipement",
    rawWikitext: "...",
    markdownContent: `# Machine de Test

## Introduction
Cette machine sert aux tests du FabLab.

## Sécurité
Port des lunettes obligatoire. Ne pas toucher les parties en mouvement.

## Utilisation
1. Allumer la machine.
2. Charger le fichier.
3. Lancer l'impression.`,
    canonicalUrl: "https://labovilleurbanne.fr/dokuwiki/equipement:test",
    lastScrapedAt: new Date().toISOString(),
    headings: ["Introduction", "Sécurité", "Utilisation"],
  };

  it("splits document by markdown headings into chunks", () => {
    const chunks = chunkMarkdownDocument(sampleDoc, { maxTokens: 100, minTokens: 5 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].documentId).toBe("equipement:test");
    expect(chunks[0].documentTitle).toBe("Machine de Test");
    expect(chunks.some((c) => c.sectionHeading === "Sécurité")).toBe(true);
    expect(chunks.some((c) => c.sectionHeading === "Utilisation")).toBe(true);
  });

  it("produces fallback chunk for short documents without sub-headings", () => {
    const shortDoc: DokuWikiDocument = {
      ...sampleDoc,
      id: "court",
      title: "Document Court",
      markdownContent: "Un petit paragraphe sans titres secondaires.",
      headings: [],
    };

    const chunks = chunkMarkdownDocument(shortDoc);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("Un petit paragraphe");
    expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
  });
});
