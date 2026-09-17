import fs from "node:fs/promises";
import path from "node:path";
import { DokuWikiDocument, WikiManifest } from "../src/server/rag/domain/types";
import { chunkMarkdownDocument } from "../src/server/rag/ingestion/text-chunker";
import { MistralEmbeddingsProvider } from "../src/server/rag/vector/embeddings";
import { LocalVectorStore } from "../src/server/rag/vector/vector-store";

import { resetConfigCache } from "../src/server/config";

// Load local environment variables
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
    resetConfigCache();
  }
} catch {
  // Optional
}

async function run() {
  console.log("=== RAG VECTOR INDEXER ===");
  const baseDir = process.env.RAG_DATA_DIR || path.join(process.cwd(), "wiki-old");
  const manifestPath = path.join(baseDir, "manifest.json");

  let manifest: WikiManifest;
  try {
    const rawManifest = await fs.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(rawManifest) as WikiManifest;
  } catch {
    console.error(`Manifest introuvable à ${manifestPath}. Lancez d'abord 'npm run rag:crawl'.`);
    process.exit(1);
  }

  const documents: DokuWikiDocument[] = [];

  for (const [id, entry] of Object.entries(manifest.documents)) {
    const mdPath = path.join(baseDir, entry.markdownPath);
    const rawPath = path.join(baseDir, entry.rawPath);

    try {
      const [mdContent, rawContent] = await Promise.all([
        fs.readFile(mdPath, "utf-8"),
        fs.readFile(rawPath, "utf-8"),
      ]);

      documents.push({
        id,
        title: entry.title,
        namespace: entry.namespace,
        rawWikitext: rawContent,
        markdownContent: mdContent,
        canonicalUrl: entry.canonicalUrl,
        lastScrapedAt: manifest.scrapedAt,
        headings: [],
      });
    } catch (err) {
      console.warn(`Could not load page ${id}:`, err);
    }
  }

  console.log(`✓ Chargé ${documents.length} documents.`);

  // 1. Chunking
  const allChunks = documents.flatMap((doc) => chunkMarkdownDocument(doc));
  console.log(`✓ Découpé en ${allChunks.length} chunks sémantiques.`);

  // 2. Embeddings via Mistral
  console.log("Génération des embeddings vectoriels via Mistral AI...");
  const embeddingsProvider = new MistralEmbeddingsProvider();
  const textsToEmbed = allChunks.map((c) => c.content);

  const vectors = await embeddingsProvider.embedDocuments(textsToEmbed);
  for (let i = 0; i < allChunks.length; i++) {
    allChunks[i].embedding = vectors[i];
  }
  console.log(`✓ ${vectors.length} vecteurs de dimension ${embeddingsProvider.dimension} générés.`);

  // 3. Save to Vector Store
  const vectorStore = new LocalVectorStore(path.join(baseDir, "vector-index.json"));
  await vectorStore.addChunks(allChunks);
  await vectorStore.save();

  // Update manifest with chunk count
  manifest.totalChunks = allChunks.length;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\n🎉 Indexation RAG terminée avec succès !`);
  console.log(`- Index sauvegardé : ${path.join(baseDir, "vector-index.json")}`);
  console.log(`- Total chunks     : ${allChunks.length}`);
}

run().catch((err) => {
  console.error("Indexation failed:", err);
  process.exit(1);
});
