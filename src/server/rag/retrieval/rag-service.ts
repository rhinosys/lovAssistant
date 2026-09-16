import { EmbeddingsProvider, RAGSearchOptions, RAGSearchResult, VectorStore } from "../domain/types";
import { MistralEmbeddingsProvider } from "../vector/embeddings";
import { LocalVectorStore } from "../vector/vector-store";
import { buildRAGContext } from "./context-builder";
import { logger } from "../../observability/logger";

export class RAGRetrievalService {
  private vectorStore: VectorStore;
  private embeddingsProvider?: EmbeddingsProvider;

  constructor(vectorStore?: VectorStore, embeddingsProvider?: EmbeddingsProvider) {
    this.vectorStore = vectorStore || new LocalVectorStore();
    this.embeddingsProvider = embeddingsProvider;
  }

  private getEmbeddingsProvider(): EmbeddingsProvider {
    if (!this.embeddingsProvider) {
      this.embeddingsProvider = new MistralEmbeddingsProvider();
    }
    return this.embeddingsProvider;
  }

  async search(query: string, options: RAGSearchOptions = {}): Promise<RAGSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    let queryVector: number[] = [];
    try {
      const provider = this.getEmbeddingsProvider();
      queryVector = await provider.embedQuery(trimmed);
    } catch (err) {
      logger.warn("Vector embedding failed, falling back to keyword search", { error: String(err) });
    }

    return this.vectorStore.search(queryVector, trimmed, options);
  }

  async getAugmentedContext(query: string, topK = 4): Promise<string> {
    const results = await this.search(query, { topK, minScore: 0.15 });
    return buildRAGContext(results);
  }
}

let ragServiceInstance: RAGRetrievalService | null = null;

export function getRAGService(): RAGRetrievalService {
  if (!ragServiceInstance) {
    ragServiceInstance = new RAGRetrievalService();
  }
  return ragServiceInstance;
}
