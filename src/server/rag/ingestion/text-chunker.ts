import { DocumentChunk, DokuWikiDocument } from "../domain/types";

export interface ChunkerOptions {
  maxTokens?: number;
  overlapTokens?: number;
  minTokens?: number;
}

const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

export const chunkMarkdownDocument = (
  doc: DokuWikiDocument,
  options: ChunkerOptions = {}
): DocumentChunk[] => {
  const maxTokens = options.maxTokens ?? 450;
  const minTokens = options.minTokens ?? 30;

  const lines = doc.markdownContent.split("\n");
  const chunks: DocumentChunk[] = [];

  let currentHeading = doc.title;
  let currentSectionLines: string[] = [];

  const flushSection = () => {
    const rawText = currentSectionLines.join("\n").trim();
    if (!rawText) {
      currentSectionLines = [];
      return;
    }

    const tokenCount = estimateTokens(rawText);

    if (tokenCount <= maxTokens) {
      if (tokenCount >= minTokens || chunks.length === 0) {
        chunks.push({
          id: `${doc.id}#chunk-${chunks.length + 1}`,
          documentId: doc.id,
          documentTitle: doc.title,
          canonicalUrl: doc.canonicalUrl,
          namespace: doc.namespace,
          sectionHeading: currentHeading,
          content: `# ${doc.title} > ${currentHeading}\n\n${rawText}`,
          tokenEstimate: tokenCount,
        });
      }
    } else {
      // Split large section by paragraphs
      const paragraphs = rawText.split(/\n\s*\n/);
      let subLines: string[] = [];
      let subTokens = 0;

      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);
        if (subTokens + paraTokens > maxTokens && subLines.length > 0) {
          const chunkContent = subLines.join("\n\n").trim();
          chunks.push({
            id: `${doc.id}#chunk-${chunks.length + 1}`,
            documentId: doc.id,
            documentTitle: doc.title,
            canonicalUrl: doc.canonicalUrl,
            namespace: doc.namespace,
            sectionHeading: currentHeading,
            content: `# ${doc.title} > ${currentHeading}\n\n${chunkContent}`,
            tokenEstimate: estimateTokens(chunkContent),
          });
          subLines = [para];
          subTokens = paraTokens;
        } else {
          subLines.push(para);
          subTokens += paraTokens;
        }
      }

      if (subLines.length > 0) {
        const chunkContent = subLines.join("\n\n").trim();
        chunks.push({
          id: `${doc.id}#chunk-${chunks.length + 1}`,
          documentId: doc.id,
          documentTitle: doc.title,
          canonicalUrl: doc.canonicalUrl,
          namespace: doc.namespace,
          sectionHeading: currentHeading,
          content: `# ${doc.title} > ${currentHeading}\n\n${chunkContent}`,
          tokenEstimate: estimateTokens(chunkContent),
        });
      }
    }

    currentSectionLines = [];
  };

  for (const line of lines) {
    const isHeading = /^#{1,4}\s+(.+)$/.exec(line);
    if (isHeading) {
      flushSection();
      currentHeading = isHeading[1].trim();
    } else {
      currentSectionLines.push(line);
    }
  }

  flushSection();

  // If document was short and produced no chunks, create single fallback chunk
  if (chunks.length === 0 && doc.markdownContent.trim()) {
    chunks.push({
      id: `${doc.id}#chunk-1`,
      documentId: doc.id,
      documentTitle: doc.title,
      canonicalUrl: doc.canonicalUrl,
      namespace: doc.namespace,
      sectionHeading: doc.title,
      content: `# ${doc.title}\n\n${doc.markdownContent.trim()}`,
      tokenEstimate: estimateTokens(doc.markdownContent),
    });
  }

  return chunks;
};
