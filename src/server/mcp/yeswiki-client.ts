import {
  YesWikiConfig,
  YesWikiPage,
  YesWikiSearchResult,
  YesWikiRecentChange,
  YesWikiBazarEntry,
  YesWikiMachineStatus,
} from "./types";
import { cleanHtml, parseYesWikiMarkupToMarkdown } from "./parsers";
import { logger } from "../observability/logger";

export class YesWikiClient {
  private baseUrl: string;
  private cookie?: string;
  private timeoutMs: number;

  constructor(config?: Partial<YesWikiConfig>) {
    const rawUrl = config?.baseUrl || process.env.YESWIKI_BASE_URL || "https://labovilleurbanne.fr/yeswiki/";
    this.baseUrl = rawUrl.replace(/\/$/, "");
    this.cookie = config?.cookie || process.env.YESWIKI_COOKIE;
    this.timeoutMs = config?.timeoutMs || 8000;
  }

  public getCanonicalUrl(pageName: string): string {
    return `${this.baseUrl}/?${encodeURIComponent(pageName)}`;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      "User-Agent": "AdminLova-YesWiki-MCP/1.0",
      ...(options.headers as Record<string, string>),
    };

    if (this.cookie) {
      headers["Cookie"] = this.cookie;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getPage(pageName: string, format: "raw" | "text" | "markdown" = "markdown"): Promise<YesWikiPage> {
    const canonicalUrl = this.getCanonicalUrl(pageName);
    // YesWiki raw endpoint
    const rawUrl = `${this.baseUrl}/?${encodeURIComponent(pageName)}/raw`;

    try {
      const res = await this.fetchWithTimeout(rawUrl);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`La page YesWiki '${pageName}' n'existe pas.`);
        }
        throw new Error(`Échec de récupération de la page (HTTP ${res.status})`);
      }

      const rawContent = await res.text();
      if (/<!doctype html|<html[\s>]/i.test(rawContent)) {
        throw new Error("YesWiki returned an HTML/error page instead of raw source text");
      }
      let formattedContent = rawContent;

      if (format === "markdown") {
        formattedContent = parseYesWikiMarkupToMarkdown(rawContent);
      } else if (format === "text") {
        formattedContent = cleanHtml(rawContent);
      }

      return {
        pageName,
        title: pageName.replace(/([A-Z])/g, " $1").trim(),
        content: formattedContent,
        canonicalUrl,
        lastModified: res.headers.get("last-modified") || undefined,
      };
    } catch (err: unknown) {
      logger.error("Failed to fetch YesWiki page", { pageName, error: String(err) });
      throw err;
    }
  }

  async searchPages(query: string, limit = 10): Promise<YesWikiSearchResult[]> {
    if (!query.trim()) return [];

    const searchUrl = `${this.baseUrl}/?RechercheTexte&phrase=${encodeURIComponent(query)}`;
    try {
      const res = await this.fetchWithTimeout(searchUrl);
      if (!res.ok) {
        throw new Error(`Échec de la recherche YesWiki (HTTP ${res.status})`);
      }

      const html = await res.text();
      const results: YesWikiSearchResult[] = [];

      // Extract search result links matching ?PageName pattern
      const regex = /<a\s+href="[^"]*?\?([A-Za-z0-9_\-]+)"[^>]*>(.*?)<\/a>/gi;
      let match;
      const seen = new Set<string>();

      while ((match = regex.exec(html)) !== null) {
        const pageName = match[1];
        if (
          pageName === "RechercheTexte" ||
          pageName === "PagePrincipale" ||
          pageName === "DerniersChangements" ||
          seen.has(pageName)
        ) {
          continue;
        }

        seen.add(pageName);
        const title = cleanHtml(match[2]) || pageName;
        results.push({
          pageName,
          title,
          snippet: `Résultat trouvé pour la recherche '${query}'`,
          canonicalUrl: this.getCanonicalUrl(pageName),
        });

        if (results.length >= limit) break;
      }

      return results;
    } catch (err: unknown) {
      logger.error("YesWiki search failed", { query, error: String(err) });
      return [];
    }
  }

  async listRecentChanges(limit = 15): Promise<YesWikiRecentChange[]> {
    const rssUrl = `${this.baseUrl}/?DerniersChangements/rss.xml`;
    try {
      const res = await this.fetchWithTimeout(rssUrl);
      if (!res.ok) {
        return [];
      }

      const xml = await res.text();
      const changes: YesWikiRecentChange[] = [];

      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;

      while ((match = itemRegex.exec(xml)) !== null && changes.length < limit) {
        const itemContent = match[1];
        const titleMatch = /<title>(.*?)<\/title>/i.exec(itemContent);
        const linkMatch = /<link>(.*?)<\/link>/i.exec(itemContent);
        const dateMatch = /<pubDate>(.*?)<\/pubDate>/i.exec(itemContent);
        const authorMatch = /<dc:creator>(.*?)<\/dc:creator>/i.exec(itemContent) || /<author>(.*?)<\/author>/i.exec(itemContent);

        const title = titleMatch ? titleMatch[1].trim() : "Page";
        const pageName = title.replace(/\s+/g, "");
        const link = linkMatch ? linkMatch[1].trim() : this.getCanonicalUrl(pageName);

        changes.push({
          pageName,
          title,
          author: authorMatch ? authorMatch[1].trim() : "Membre Fablab",
          updatedAt: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
          canonicalUrl: link,
        });
      }

      return changes;
    } catch (err: unknown) {
      logger.warn("Failed to fetch YesWiki recent changes RSS", { error: String(err) });
      return [];
    }
  }

  async getBazarEntries(formId?: string, category?: string, limit = 20): Promise<YesWikiBazarEntry[]> {
    const endpoint = `${this.baseUrl}/?BazarAPI&action=list${formId ? `&form=${formId}` : ""}${category ? `&cat=${category}` : ""}`;
    try {
      const res = await this.fetchWithTimeout(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.slice(0, limit).map((item: any, idx: number) => ({
            id: String(item.id || idx),
            title: item.title || item.bf_titre || "Fiche Bazar",
            category: item.category || category,
            description: item.description || item.bf_description,
            fields: item,
            canonicalUrl: item.pageName ? this.getCanonicalUrl(item.pageName) : endpoint,
          }));
        }
      }
    } catch {
      // Fallback
    }

    // An unavailable endpoint is not an inventory. Never substitute demo machines.
    logger.warn("YesWiki Bazar inventory unavailable", { formId });
    return [];
  }

  async getMachineStatus(machineName: string): Promise<YesWikiMachineStatus> {
    const entries = await this.getBazarEntries("machines");
    const found = entries.find(entry => entry.title.toLowerCase().includes(machineName.toLowerCase()));
    const fields = found?.fields ?? {};
    const raw = String(fields.etat ?? "").toLowerCase();
    const statuses: Record<string, YesWikiMachineStatus["status"]> = {
      disponible: "disponible", maintenance: "maintenance", reserve: "reserve",
      réservé: "reserve", hors_service: "hors_service", "hors service": "hors_service",
    };
    return {
      name: found?.title ?? machineName,
      status: statuses[raw] ?? "inconnu",
      materials: Array.isArray(fields.materiaux) ? fields.materiaux.filter((value: unknown) => typeof value === "string") : [],
      notes: typeof fields.description === "string" ? fields.description : "Disponibilité et caractéristiques non confirmées par les sources.",
      guideUrl: found?.canonicalUrl,
    };
  }

  async savePage(pageName: string, content: string, summary: string, userSignature?: string): Promise<{ success: boolean; pageName: string; revisionId: string }> {
    const url = `${this.baseUrl}/?${encodeURIComponent(pageName)}`;
    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        body: content,
        comment: `${summary} (Signé: ${userSignature || "Assistant Fablab"})`,
        submit: "Enregistrer",
      }),
    });

    if (!res.ok) {
      throw new Error(`Échec de l'enregistrement de la page sur YesWiki (HTTP ${res.status})`);
    }

    return {
      success: true,
      pageName,
      revisionId: `rev_${Date.now()}`,
    };
  }
}
