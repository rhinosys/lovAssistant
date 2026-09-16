export class RAGError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RAGError";
  }
}

export class CrawlerError extends RAGError {
  constructor(message: string, public readonly pageId?: string, cause?: unknown) {
    super(message, cause);
    this.name = "CrawlerError";
  }
}

export class EmbeddingError extends RAGError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "EmbeddingError";
  }
}

export class VectorStoreError extends RAGError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "VectorStoreError";
  }
}
