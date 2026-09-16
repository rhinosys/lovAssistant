import { describe, it, expect } from "vitest";
import { RAGRetrievalService } from "./rag-service";
import { LocalVectorStore } from "../vector/vector-store";
import { EmbeddingsProvider, DocumentChunk } from "../domain/types";
import { buildRAGContext } from "./context-builder";

describe("RAG Retrieval Service & Context Builder", () => {
  const mockChunks: DocumentChunk[] = [
    {
      id: "ag_2023",
      documentId: "asso:cr:2023-assemblee_generale",
      documentTitle: "Assemblée Générale 2023",
      canonicalUrl: "https://labovilleurbanne.fr/dokuwiki/asso:cr:2023",
      namespace: "asso:cr",
      sectionHeading: "Bilan moral",
      content: "Bilan moral de l'association LOV en 2023 avec 150 adhérents actifs.",
      tokenEstimate: 30,
      embedding: [0.8, 0.2],
    },
  ];

  const mockEmbeddingsProvider: EmbeddingsProvider = {
    dimension: 2,
    async embedDocuments(texts) {
      return texts.map(() => [0.8, 0.2]);
    },
    async embedQuery() {
      return [0.8, 0.2];
    },
  };

  it("retrieves matching chunks and builds formatted RAG prompt context", async () => {
    const store = new LocalVectorStore();
    await store.addChunks(mockChunks);

    const service = new RAGRetrievalService(store, mockEmbeddingsProvider);
    const results = await service.search("adhérents bilan 2023", { topK: 1 });

    expect(results).toHaveLength(1);
    expect(results[0].chunk.documentId).toBe("asso:cr:2023-assemblee_generale");

    const context = buildRAGContext(results);
    expect(context).toContain("ARCHIVES DU DOKUWIKI HISTORIQUE");
    expect(context).toContain("Assemblée Générale 2023");
    expect(context).toContain("150 adhérents actifs");
    expect(context).toContain("https://labovilleurbanne.fr/dokuwiki/asso:cr:2023");
  });

  it("returns empty string when no search results match", () => {
    expect(buildRAGContext([])).toBe("");
  });
});
