export interface DokuWikiDocument {
  id: string; // e.g. "equipement:impression_3d:lulzbot-taz-workhorse"
  title: string;
  namespace: string; // e.g. "equipement:impression_3d"
  rawWikitext: string;
  markdownContent: string;
  canonicalUrl: string;
  lastScrapedAt: string;
  headings: string[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  canonicalUrl: string;
  namespace: string;
  sectionHeading: string;
  content: string;
  tokenEstimate: number;
  embedding?: number[];
}

export interface RAGSearchOptions {
  topK?: number;
  minScore?: number;
  namespace?: string;
  mode?: "hybrid" | "vector" | "keyword";
}

export interface RAGSearchResult {
  chunk: DocumentChunk;
  score: number;
  matchType: "vector" | "keyword" | "hybrid";
}

export interface EmbeddingsProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
}

export interface VectorStore {
  addChunks(chunks: DocumentChunk[]): Promise<void>;
  search(queryVector: number[], queryText: string, options?: RAGSearchOptions): Promise<RAGSearchResult[]>;
  getChunkCount(): number;
  save(): Promise<void>;
  load(): Promise<boolean>;
}

export interface WikiManifestEntry {
  id: string;
  title: string;
  namespace: string;
  rawPath: string;
  markdownPath: string;
  canonicalUrl: string;
  byteSize: number;
  chunkCount?: number;
}

export interface WikiManifest {
  scrapedAt: string;
  totalDocuments: number;
  totalChunks?: number;
  documents: Record<string, WikiManifestEntry>;
}
