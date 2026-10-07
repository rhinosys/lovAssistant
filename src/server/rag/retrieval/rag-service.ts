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

  // Empty vector when embeddings are unavailable: searches then fall back to keywords.
  async embedQuery(query: string): Promise<number[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    try {
      return await this.getEmbeddingsProvider().embedQuery(trimmed);
    } catch (err) {
      logger.warn("Vector embedding failed, falling back to keyword search", { error: String(err) });
      return [];
    }
  }

  // Pass a precomputed queryVector to share one embedding between several indexes.
  async search(query: string, options: RAGSearchOptions & { queryVector?: number[] } = {}): Promise<RAGSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const { queryVector, ...searchOptions } = options;
    const vector = queryVector ?? (await this.embedQuery(trimmed));
    return this.vectorStore.search(vector, trimmed, searchOptions);
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
