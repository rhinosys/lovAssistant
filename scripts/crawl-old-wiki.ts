import path from "node:path";
import { DokuWikiCrawler } from "../src/server/rag/ingestion/dokuwiki-crawler";

// Load local environment variables
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // Optional
}

async function run() {
  console.log("=== DOKUWIKI CRAWLER (wiki-old) ===");
  const outputDir = process.env.RAG_DATA_DIR || path.join(process.cwd(), "wiki-old");
  const crawler = new DokuWikiCrawler({
    baseUrl: "https://labovilleurbanne.fr/dokuwiki",
    outputDir,
    delayMs: 80,
    maxPages: 250,
  });

  const docs = await crawler.crawl("start");
  console.log(`\n✓ Crawl terminé avec succès !`);
  console.log(`- Total pages téléchargées : ${docs.length}`);
  console.log(`- Dossier brut             : ${path.join(outputDir, "raw")}`);
  console.log(`- Dossier Markdown         : ${path.join(outputDir, "markdown")}`);
  console.log(`- Fichier Manifest         : ${path.join(outputDir, "manifest.json")}`);
}

run().catch((err) => {
  console.error("Crawler failure:", err);
  process.exit(1);
});
