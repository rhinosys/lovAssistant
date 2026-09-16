import { describe, it, expect } from "vitest";
import { LocalVectorStore } from "./vector-store";
import { computeCosineSimilarity } from "./embeddings";
import { DocumentChunk } from "../domain/types";

describe("Vector Store & Cosine Similarity", () => {
  it("computes cosine similarity accurately", () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];
    const v4 = [0.7071, 0.7071, 0];

    expect(computeCosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    expect(computeCosineSimilarity(v1, v3)).toBeCloseTo(0.0);
    expect(computeCosineSimilarity(v1, v4)).toBeCloseTo(0.7071, 3);
  });

  it("handles empty or mismatched vectors gracefully", () => {
    expect(computeCosineSimilarity([], [])).toBe(0);
    expect(computeCosineSimilarity([1, 2], [1])).toBe(0);
  });

  it("performs hybrid search matching both keywords and vectors", async () => {
    const store = new LocalVectorStore();
    const chunks: DocumentChunk[] = [
      {
        id: "c1",
        documentId: "laser",
        documentTitle: "Découpeuse Laser CO2",
        canonicalUrl: "https://example.com/laser",
        namespace: "equipement",
        sectionHeading: "Sécurité",
        content: "Aspiration des fumées obligatoire sur la découpeuse laser.",
        tokenEstimate: 20,
        embedding: [0.9, 0.1, 0.0],
      },
      {
        id: "c2",
        documentId: "prusa",
        documentTitle: "Imprimante 3D Prusa",
        canonicalUrl: "https://example.com/prusa",
        namespace: "equipement",
        sectionHeading: "Plateau",
        content: "Nettoyer le plateau d'impression 3D à l'alcool isopropylique.",
        tokenEstimate: 25,
        embedding: [0.1, 0.9, 0.0],
      },
    ];

    await store.addChunks(chunks);

    // Vector search matching laser
    const vectorMatches = await store.search([0.9, 0.1, 0.0], "laser", { topK: 1 });
    expect(vectorMatches).toHaveLength(1);
    expect(vectorMatches[0].chunk.documentId).toBe("laser");

    // Keyword search matching prusa
    const keywordMatches = await store.search([], "prusa alcool", { topK: 1 });
    expect(keywordMatches).toHaveLength(1);
    expect(keywordMatches[0].chunk.documentId).toBe("prusa");
  });
});
