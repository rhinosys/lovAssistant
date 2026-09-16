import { z } from "zod";
import { YesWikiClient } from "./yeswiki-client";
import { createConfirmationToken, verifyConfirmationToken, hashContent } from "./tokens";
import { generateSimpleDiff } from "./parsers";
import { logger } from "../observability/logger";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (params: any, client: YesWikiClient) => Promise<any>;
}

export const yeswikiTools: Record<string, ToolDefinition> = {
  yeswiki_search_pages: {
    name: "yeswiki_search_pages",
    description: "Recherche des pages dans le YesWiki du Fablab par mots-clés.",
    parameters: z.object({
      query: z.string().min(1, "La requête de recherche ne peut pas être vide"),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    execute: async (params: { query: string; limit?: number }, client: YesWikiClient) => {
      const results = await client.searchPages(params.query, params.limit);
      return {
        count: results.length,
        results,
      };
    },
  },

  yeswiki_get_page: {
    name: "yeswiki_get_page",
    description: "Récupère le contenu textuel et les métadonnées d'une page YesWiki.",
    parameters: z.object({
      page_name: z.string().min(1, "Le nom de la page est requis"),
      format: z.enum(["markdown", "text", "raw"]).default("markdown"),
    }),
    execute: async (params: { page_name: string; format?: "markdown" | "text" | "raw" }, client: YesWikiClient) => {
      const page = await client.getPage(params.page_name, params.format);
      return page;
    },
  },

  yeswiki_list_recent_changes: {
    name: "yeswiki_list_recent_changes",
    description: "Liste les dernières modifications ou créations de pages sur le YesWiki.",
    parameters: z.object({
      limit: z.number().int().min(1).max(50).default(15),
    }),
    execute: async (params: { limit?: number }, client: YesWikiClient) => {
      const changes = await client.listRecentChanges(params.limit);
      return {
        count: changes.length,
        changes,
      };
    },
  },

  yeswiki_get_bazar_entries: {
    name: "yeswiki_get_bazar_entries",
    description: "Consulte les fiches structurées du module Bazar (machines, projets, ateliers).",
    parameters: z.object({
      form_id: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: async (params: { form_id?: string; category?: string; limit?: number }, client: YesWikiClient) => {
      const entries = await client.getBazarEntries(params.form_id, params.category, params.limit);
      return {
        count: entries.length,
        entries,
      };
    },
  },

  yeswiki_get_machine_status: {
    name: "yeswiki_get_machine_status",
    description: "Obtient le statut opérationnel, les matériaux compatibles et le guide d'une machine du fablab.",
    parameters: z.object({
      machine_name: z.string().min(1, "Le nom de la machine est requis"),
    }),
    execute: async (params: { machine_name: string }, client: YesWikiClient) => {
      const status = await client.getMachineStatus(params.machine_name);
      return status;
    },
  },

  yeswiki_prepare_page_update: {
    name: "yeswiki_prepare_page_update",
    description: "Prépare une modification ou création de page sur YesWiki et génère un aperçu/diff avec un token de confirmation valide 5 minutes. N'écrit rien sur le wiki.",
    parameters: z.object({
      page_name: z.string().min(1, "Nom de la page à modifier"),
      new_content: z.string().min(1, "Nouveau contenu wikitext ou markdown"),
      summary: z.string().min(1, "Résumé de la modification"),
    }),
    execute: async (params: { page_name: string; new_content: string; summary: string }, client: YesWikiClient) => {
      let currentContent = "";
      try {
        const existing = await client.getPage(params.page_name, "raw");
        currentContent = existing.content;
      } catch {
        // Page doesn't exist yet -> full creation
      }

      const diff = generateSimpleDiff(currentContent, params.new_content);
      const { token, expiresAt } = createConfirmationToken(
        params.page_name,
        params.new_content,
        params.summary,
        300
      );

      logger.info("Page update prepared", { pageName: params.page_name, summary: params.summary });

      return {
        status: "prepared",
        pageName: params.page_name,
        summary: params.summary,
        diff,
        confirmationToken: token,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        instructions: "Pour appliquer cette modification, l'utilisateur doit confirmer explicitement l'action avec ce confirmationToken.",
      };
    },
  },

  yeswiki_apply_page_update: {
    name: "yeswiki_apply_page_update",
    description: "Applique définitivement une modification préparée sur le YesWiki après confirmation humaine.",
    parameters: z.object({
      page_name: z.string().min(1),
      new_content: z.string().min(1),
      summary: z.string().min(1),
      confirmation_token: z.string().min(10, "Token de confirmation requis"),
      user_signature: z.string().optional(),
    }),
    execute: async (
      params: {
        page_name: string;
        new_content: string;
        summary: string;
        confirmation_token: string;
        user_signature?: string;
      },
      client: YesWikiClient
    ) => {
      const payload = verifyConfirmationToken(params.confirmation_token);
      if (!payload) {
        throw new Error("Token de confirmation invalide ou expiré (durée de validité : 5 minutes).");
      }

      if (payload.pageName !== params.page_name) {
        throw new Error(`Incohérence : le token a été émis pour '${payload.pageName}' et non '${params.page_name}'.`);
      }

      const currentHash = hashContent(params.new_content);
      if (payload.contentHash !== currentHash) {
        throw new Error("Le contenu à enregistrer a été altéré depuis la préparation de la modification.");
      }

      const result = await client.savePage(
        params.page_name,
        params.new_content,
        params.summary,
        params.user_signature
      );

      logger.info("Page update committed to YesWiki", {
        pageName: params.page_name,
        revisionId: result.revisionId,
      });

      return {
        status: "applied",
        pageName: params.page_name,
        revisionId: result.revisionId,
        canonicalUrl: client.getCanonicalUrl(params.page_name),
        message: `La page '${params.page_name}' a été mise à jour avec succès sur YesWiki.`,
      };
    },
  },

  dokuwiki_rag_search: {
    name: "dokuwiki_rag_search",
    description: "Recherche sémantique et vectorielle dans les archives de l'ancien DokuWiki du FabLab (wiki-old : machines historiques, AG/CA, anciens projets).",
    parameters: z.object({
      query: z.string().min(1, "La requête de recherche ne peut pas être vide"),
      top_k: z.number().int().min(1).max(10).default(4),
      namespace: z.string().optional(),
    }),
    execute: async (params: { query: string; top_k?: number; namespace?: string }) => {
      const { getRAGService } = await import("../rag/retrieval/rag-service");
      const rag = getRAGService();
      const results = await rag.search(params.query, {
        topK: params.top_k,
        namespace: params.namespace,
      });

      return {
        query: params.query,
        count: results.length,
        results: results.map((r) => ({
          title: r.chunk.documentTitle,
          section: r.chunk.sectionHeading,
          pageId: r.chunk.documentId,
          score: Number((r.score * 100).toFixed(1)),
          matchType: r.matchType,
          canonicalUrl: r.chunk.canonicalUrl,
          content: r.chunk.content,
        })),
      };
    },
  },
};

