import fs from "node:fs/promises";
import path from "node:path";
import { DocumentChunk, RAGSearchOptions, RAGSearchResult, VectorStore } from "../domain/types";
import { computeCosineSimilarity } from "./embeddings";
import { VectorStoreError } from "../domain/errors";
import { logger } from "../../observability/logger";

interface SerializedVectorIndex {
  version: string;
  createdAt: string;
  chunkCount: number;
  chunks: DocumentChunk[];
}

export class LocalVectorStore implements VectorStore {
  private chunks: DocumentChunk[] = [];
  private indexPath: string;

  constructor(indexPath?: string) {
    this.indexPath = indexPath || path.join(process.cwd(), "wiki-old", "vector-index.json");
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    this.chunks.push(...chunks);
  }

  private computeBM25Score(queryWords: string[], content: string, title: string): number {
    const text = `${title} ${content}`.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      if (!word || word.length < 2) continue;
      const count = (text.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length;
      if (count > 0) {
        score += 1 + Math.log(count);
      } else if (text.includes(word)) {
        score += 0.5;
      }
    }

    return score;
  }

  async search(
    queryVector: number[] = [],
    queryText = "",
    options: RAGSearchOptions = {}
  ): Promise<RAGSearchResult[]> {
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.05;
    const mode = options.mode ?? "hybrid";
    const namespaceFilter = options.namespace;

    if (this.chunks.length === 0) {
      await this.load();
    }

    if (this.chunks.length === 0) {
      return [];
    }

    const queryWords = queryText
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const scored: RAGSearchResult[] = [];

    for (const chunk of this.chunks) {
      if (namespaceFilter && !chunk.namespace.startsWith(namespaceFilter)) {
        continue;
      }

      let vectorScore = 0;
      if (queryVector.length > 0 && chunk.embedding && chunk.embedding.length > 0) {
        vectorScore = computeCosineSimilarity(queryVector, chunk.embedding);
      }

      let keywordScore = 0;
      if (queryWords.length > 0) {
        keywordScore = this.computeBM25Score(queryWords, chunk.content, chunk.documentTitle);
      }

      let finalScore = 0;
      let matchType: RAGSearchResult["matchType"] = "hybrid";

      if (mode === "vector") {
        finalScore = vectorScore;
        matchType = "vector";
      } else if (mode === "keyword") {
        finalScore = keywordScore > 0 ? Math.min(keywordScore / 5, 1) : 0;
        matchType = "keyword";
      } else {
        // Hybrid mode (weighted)
        const normalizedKeyword = Math.min(keywordScore / 4, 1);
        finalScore = vectorScore * 0.7 + normalizedKeyword * 0.3;
        matchType = vectorScore > 0 && keywordScore > 0 ? "hybrid" : vectorScore > 0 ? "vector" : "keyword";
      }

      if (finalScore >= minScore) {
        scored.push({
          chunk,
          score: finalScore,
          matchType,
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.indexPath);
      await fs.mkdir(dir, { recursive: true });

      const payload: SerializedVectorIndex = {
        version: "1.0",
        createdAt: new Date().toISOString(),
        chunkCount: this.chunks.length,
        chunks: this.chunks,
      };

      await fs.writeFile(this.indexPath, JSON.stringify(payload), "utf-8");
      logger.info("Vector store index saved successfully", {
        path: this.indexPath,
        chunkCount: this.chunks.length,
      });
    } catch (err: unknown) {
      throw new VectorStoreError(`Failed to save vector store to ${this.indexPath}`, err);
    }
  }

  async load(): Promise<boolean> {
    try {
      const data = await fs.readFile(this.indexPath, "utf-8");
      const payload = JSON.parse(data) as SerializedVectorIndex;
      if (Array.isArray(payload.chunks)) {
        this.chunks = payload.chunks;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
