import { getConfig } from "../../config";
import { EmbeddingsProvider } from "../domain/types";
import { EmbeddingError } from "../domain/errors";
import { logger } from "../../observability/logger";

export const computeCosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

export class MistralEmbeddingsProvider implements EmbeddingsProvider {
  readonly dimension = 1024;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey?: string, baseUrl?: string, model = "mistral-embed") {
    let key = apiKey;
    let url = baseUrl;
    try {
      const config = getConfig();
      key = key || config.MISTRAL_API_KEY;
      url = url || config.MISTRAL_BASE_URL;
    } catch {
      // ignore
    }
    this.apiKey = key || process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_TOKEN || "";
    this.baseUrl = (url || process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1").replace(/\/$/, "");
    this.model = model;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) {
      throw new EmbeddingError("MISTRAL_API_KEY is missing for embeddings generation.");
    }

    const url = `${this.baseUrl}/embeddings`;
    const batchSize = 16;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: batch,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new EmbeddingError(`Mistral embeddings HTTP ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as {
          data: Array<{ embedding: number[]; index: number }>;
        };

        const sorted = data.data.sort((a, b) => a.index - b.index);
        for (const item of sorted) {
          results.push(item.embedding);
        }
      } catch (err: unknown) {
        if (err instanceof EmbeddingError) throw err;
        logger.error("Failed to generate Mistral embeddings", { error: String(err) });
        throw new EmbeddingError(`Embeddings request failed: ${String(err)}`, err);
      }
    }

    return results;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [result] = await this.embedDocuments([text]);
    if (!result) {
      throw new EmbeddingError("Failed to embed query text.");
    }
    return result;
  }
}
