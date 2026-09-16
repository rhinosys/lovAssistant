import { getRAGService } from "../src/server/rag";

// Load local environment variables
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // Optional
}

async function run() {
  const query = process.argv.slice(2).join(" ") || "imprimante 3D lulzbot";
  console.log(`=== RECHERCHE RAG DOKUWIKI ===`);
  console.log(`Requête: "${query}"\n`);

  const rag = getRAGService();
  const results = await rag.search(query, { topK: 5 });

  if (results.length === 0) {
    console.log("Aucun résultat trouvé dans l'index.");
    return;
  }

  console.log(`Trouvé ${results.length} résultats :\n`);
  for (let i = 0; i < results.length; i++) {
    const { chunk, score, matchType } = results[i];
    console.log(`[${i + 1}] (${matchType.toUpperCase()} - ${(score * 100).toFixed(1)}%) : ${chunk.documentTitle} > ${chunk.sectionHeading}`);
    console.log(`    Page: ${chunk.documentId}`);
    console.log(`    URL:  ${chunk.canonicalUrl}`);
    console.log(`    Aperçu: ${chunk.content.split("\n").slice(0, 4).join(" ").substring(0, 140)}...`);
    console.log("--------------------------------------------------");
  }
}

run().catch((err) => {
  console.error("Query failed:", err);
  process.exit(1);
});
