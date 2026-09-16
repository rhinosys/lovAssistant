import { RAGSearchResult } from "../domain/types";

export const buildRAGContext = (results: RAGSearchResult[]): string => {
  if (results.length === 0) {
    return "";
  }

  const sections = results.map((res, index) => {
    const { chunk, score } = res;
    return `### Source [${index + 1}]: ${chunk.documentTitle} (${chunk.sectionHeading})
- Page: ${chunk.documentId}
- URL: ${chunk.canonicalUrl}
- Pertinence: ${(score * 100).toFixed(1)}%

${chunk.content}`;
  });

  return `--- ARCHIVES DU DOKUWIKI HISTORIQUE (wiki-old) ---\n${sections.join(
    "\n\n----------------------------------------\n\n"
  )}\n--- FIN DES ARCHIVES DOKUWIKI ---`;
};
