import fs from "node:fs/promises";
import path from "node:path";
import { DokuWikiDocument, WikiManifest, WikiManifestEntry } from "../domain/types";
import { CrawlerError } from "../domain/errors";
import { parseDokuWikiToMarkdown } from "./dokuwiki-parser";
import { logger } from "../../observability/logger";

export interface CrawlerOptions {
  baseUrl?: string;
  outputDir?: string;
  delayMs?: number;
  maxPages?: number;
  timeoutMs?: number;
}

export class DokuWikiCrawler {
  private baseUrl: string;
  private outputDir: string;
  private delayMs: number;
  private maxPages: number;
  private timeoutMs: number;

  constructor(options: CrawlerOptions = {}) {
    this.baseUrl = (options.baseUrl || "https://labovilleurbanne.fr/dokuwiki").replace(/\/$/, "");
    this.outputDir = options.outputDir || path.join(process.cwd(), "wiki-old");
    this.delayMs = options.delayMs ?? 100;
    this.maxPages = options.maxPages ?? 200;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private sanitizeFilename(id: string): string {
    return id.replace(/[:/\\]/g, "__");
  }

  private extractNamespace(id: string): string {
    const parts = id.split(":");
    return parts.length > 1 ? parts.slice(0, -1).join(":") : "root";
  }

  private async sleep(ms: number) {
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  async fetchRawPage(pageId: string): Promise<string | null> {
    const url = `${this.baseUrl}/${encodeURIComponent(pageId)}?do=export_raw`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "AdminLova-RAG-Crawler/1.0" },
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const text = await res.text();
      if (
        !text.trim() ||
        text.includes("Cette page n'existe pas encore") ||
        text.includes("Topic does not exist")
      ) {
        return null;
      }

      return text;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new CrawlerError(`Timeout fetching page ${pageId}`, pageId, err);
      }
      logger.warn(`Failed to fetch page ${pageId}`, { error: String(err) });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  extractLinks(wikitext: string): string[] {
    const linkRegex = /\[\[([^\]|#]+)/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(wikitext)) !== null) {
      const target = match[1].trim();
      if (
        !target ||
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("mailto:") ||
        target.startsWith("#") ||
        target.endsWith(".png") ||
        target.endsWith(".jpg") ||
        target.endsWith(".pdf")
      ) {
        continue;
      }
      links.push(target);
    }

    return links;
  }

  async crawl(startPageId = "start"): Promise<DokuWikiDocument[]> {
    const rawDir = path.join(this.outputDir, "raw");
    const mdDir = path.join(this.outputDir, "markdown");

    await fs.mkdir(rawDir, { recursive: true });
    await fs.mkdir(mdDir, { recursive: true });

    const visited = new Set<string>();
    const queue = [startPageId];
    const documents: DokuWikiDocument[] = [];
    const manifestEntries: Record<string, WikiManifestEntry> = {};

    logger.info("Starting DokuWiki crawl", { startPageId, baseUrl: this.baseUrl });

    while (queue.length > 0 && visited.size < this.maxPages) {
      const pageId = queue.shift()!;
      if (visited.has(pageId)) continue;
      visited.add(pageId);

      await this.sleep(this.delayMs);
      const rawText = await this.fetchRawPage(pageId);

      if (!rawText) continue;

      const parsed = parseDokuWikiToMarkdown(rawText, pageId);
      const namespace = this.extractNamespace(pageId);
      const canonicalUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}`;
      const safeName = this.sanitizeFilename(pageId);

      const rawPath = path.join(rawDir, `${safeName}.txt`);
      const mdPath = path.join(mdDir, `${safeName}.md`);

      await fs.writeFile(rawPath, rawText, "utf-8");
      await fs.writeFile(mdPath, parsed.markdown, "utf-8");

      const doc: DokuWikiDocument = {
        id: pageId,
        title: parsed.title,
        namespace,
        rawWikitext: rawText,
        markdownContent: parsed.markdown,
        canonicalUrl,
        lastScrapedAt: new Date().toISOString(),
        headings: parsed.headings,
      };

      documents.push(doc);

      manifestEntries[pageId] = {
        id: pageId,
        title: parsed.title,
        namespace,
        rawPath: `raw/${safeName}.txt`,
        markdownPath: `markdown/${safeName}.md`,
        canonicalUrl,
        byteSize: Buffer.byteLength(parsed.markdown, "utf-8"),
      };

      // Queue discovered internal links
      const discoveredLinks = this.extractLinks(rawText);
      for (const link of discoveredLinks) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
    }

    const manifest: WikiManifest = {
      scrapedAt: new Date().toISOString(),
      totalDocuments: documents.length,
      documents: manifestEntries,
    };

    const manifestPath = path.join(this.outputDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    logger.info("DokuWiki crawl completed successfully", {
      totalDocuments: documents.length,
      outputDir: this.outputDir,
    });

    return documents;
  }
}
