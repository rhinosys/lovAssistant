import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService, AuthorizationError } from "@/server/auth/session";
import { assertThreadOwnership, ThreadNotFoundError } from "@/server/chat/ownership";
import { getThreadRepository, getMessageRepository } from "@/server/persistence";
import { getModelProvider } from "@/server/model";
import {
  ChatMessage,
  OllamaUnavailableError,
  ModelNotFoundError,
  OllamaTimeoutError,
  MistralAuthenticationError,
  MistralRateLimitError,
  MistralTimeoutError,
  MistralAPIError,
} from "@/server/model";
import { logger } from "@/server/observability/logger";
import { YesWikiClient } from "@/server/mcp/yeswiki-client";

async function fetchYesWikiGroundingContext(query: string): Promise<string> {
  const normalized = query.toLowerCase();
  const yeswikiKeywords = [
    "wiki",
    "machine",
    "imprimante",
    "3d",
    "decoupeuse",
    "laser",
    "cnc",
    "fablab",
    "lov",
    "bazar",
    "statut",
    "materiel",
    "outil",
    "projet",
    "atelier",
    "mcp",
    "combien",
  ];
  const isRelevant = yeswikiKeywords.some((kw) => normalized.includes(kw));

  if (!isRelevant) {
    return "";
  }

  const client = new YesWikiClient();
  const contextParts: string[] = [];

  try {
    if (
      normalized.includes("machine") ||
      normalized.includes("imprimante") ||
      normalized.includes("3d") ||
      normalized.includes("laser") ||
      normalized.includes("cnc") ||
      normalized.includes("outil") ||
      normalized.includes("combien")
    ) {
      const [machinesPage, zonesPage, bazarMachines] = await Promise.allSettled([
        client.getPage("MachinesEtOutils", "markdown"),
        client.getPage("ZonesDuLocal", "markdown"),
        client.getBazarEntries("machines"),
      ]);

      if (machinesPage.status === "fulfilled" && machinesPage.value.content) {
        contextParts.push(`Page Wiki 'MachinesEtOutils' (${machinesPage.value.canonicalUrl}):\n${machinesPage.value.content}`);
      }
      if (zonesPage.status === "fulfilled" && zonesPage.value.content) {
        contextParts.push(`Page Wiki 'ZonesDuLocal' (${zonesPage.value.canonicalUrl}):\n${zonesPage.value.content}`);
      }
      if (bazarMachines.status === "fulfilled" && bazarMachines.value.length > 0) {
        contextParts.push(
          `Inventaire Bazar Machines:\n` +
            bazarMachines.value
              .map((m) => `- ${m.title}: ${JSON.stringify(m.fields)} (Lien: ${m.canonicalUrl})`)
              .join("\n")
        );
      }
    } else {
      const searchResults = await client.searchPages(query, 3);
      if (searchResults.length > 0) {
        contextParts.push(
          `Résultats de recherche sur le Wiki pour "${query}":\n` +
            searchResults.map((r) => `- ${r.title} (${r.canonicalUrl})`).join("\n")
        );
        const firstPage = await client.getPage(searchResults[0].pageName, "markdown").catch(() => null);
        if (firstPage?.content) {
          contextParts.push(`Extrait de la page '${firstPage.pageName}':\n${firstPage.content.slice(0, 1500)}`);
        }
      }
    }
  } catch (err) {
    logger.warn("Failed to fetch YesWiki grounding context", { error: String(err) });
  }

  return contextParts.join("\n\n");
}

async function fetchDokuWikiRAGContext(query: string): Promise<string> {
  try {
    const { getRAGService } = await import("@/server/rag/retrieval/rag-service");
    const rag = getRAGService();
    const context = await rag.getAugmentedContext(query, 3);
    return context;
  } catch (err) {
    logger.warn("Failed to retrieve DokuWiki RAG context", { error: String(err) });
    return "";
  }
}

const chatRequestSchema = z.object({
  threadId: z.string().optional(),
  message: z
    .string()
    .min(1, "Le message ne peut pas être vide")
    .max(10000, "Le message ne peut pas dépasser 10 000 caractères"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(10000),
      })
    )
    .optional(),
  model: z.string().optional(),
  provider: z.enum(["ollama", "mistral"]).optional(),
});

export async function POST(req: NextRequest) {
  const start = Date.now();
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}`;

  try {
    const user = await authService.authenticateRequest(req.headers);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Corps de requête JSON invalide" } },
        { status: 400 }
      );
    }

    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues.map((i) => i.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const { message, messages: incomingHistory, model, provider } = parseResult.data;
    let threadId = parseResult.data.threadId;

    const threadRepo = getThreadRepository();
    const messageRepo = getMessageRepository();

    if (threadId) {
      await assertThreadOwnership(user.id, threadId);
    } else {
      const derivedTitle = message.length > 40 ? `${message.substring(0, 40)}...` : message;
      const newThread = await threadRepo.create({
        userId: user.id,
        title: derivedTitle,
      });
      threadId = newThread.id;
    }

    // Persist incoming user message
    await messageRepo.create({
      threadId,
      role: "user",
      content: message,
      metadata: { source: "web_ui", provider: provider || "default" },
    });

    // Build context messages for provider
    let fullMessages: ChatMessage[] = [];
    if (incomingHistory && incomingHistory.length > 0) {
      fullMessages = incomingHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      // Append current user message if not already the last message
      const lastMsg = fullMessages[fullMessages.length - 1];
      if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== message) {
        fullMessages.push({ role: "user", content: message });
      }
    } else {
      const dbHistory = await messageRepo.listByThreadId(threadId);
      fullMessages = dbHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    const [groundingContext, dokuwikiRagContext] = await Promise.all([
      fetchYesWikiGroundingContext(message),
      fetchDokuWikiRAGContext(message),
    ]);

    const systemPromptText = `Tu es l'assistant IA officiel du FabLab de Villeurbanne (LOV).
Tu aides les adhérents et membres à comprendre les règles de l'atelier, utiliser les machines, consulter la documentation et trouver les informations sur le wiki du LOV (https://labovilleurbanne.fr/yeswiki/?PagePrincipale).
Tu as également accès aux archives historiques du DokuWiki du FabLab (https://labovilleurbanne.fr/dokuwiki/).
Tu réponds en français, avec clarté, bienveillance et précision.

RÈGLES STRICTES D'ANCRAGE AUX SOURCES :
- Base tes réponses UNIQUEMENT sur les données fournies ci-dessous (wiki YesWiki actuel et archives DokuWiki). N'utilise jamais tes connaissances générales pour décrire une machine, un modèle, une marque ou une procédure spécifique au LOV.
- Ne mentionne JAMAIS un nom de machine, de modèle (ex: marque/référence d'imprimante) qui n'apparaît pas explicitement dans les sources fournies, même s'il te semble plausible ou courant dans d'autres FabLabs.
- N'invente jamais de lien, d'URL ou de référence (vidéo, documentation) qui n'est pas donné tel quel dans les sources.
- Si les sources fournies ne contiennent pas l'information demandée, dis-le clairement ("Je n'ai pas trouvé cette information dans le wiki du LOV") plutôt que de répondre avec des connaissances générales. Tu peux alors proposer de reformuler la question ou d'orienter vers un membre du LOV.
${groundingContext ? `\n--- DONNÉES DU WIKI ACTUEL (YESWIKI) ---\n${groundingContext}\n----------------------------------------` : ""}
${dokuwikiRagContext ? `\n${dokuwikiRagContext}\n----------------------------------------` : ""}
${!groundingContext && !dokuwikiRagContext ? "\n(Aucune donnée pertinente trouvée dans les sources pour cette question.)" : ""}

RAPPEL FINAL (le plus important) : les seules machines, marques et modèles que tu as le droit de citer sont ceux qui apparaissent MOT POUR MOT dans les blocs de sources ci-dessus. Avant d'écrire le nom d'une machine, vérifie qu'il apparaît littéralement dans les sources. Si tu as un doute, ou si aucune source pertinente n'est fournie ci-dessus, réponds que tu n'as pas trouvé l'information dans le wiki du LOV — ne complète JAMAIS avec une machine ou un modèle générique que tu connais par ailleurs (ex: ne dis jamais "Prusa" si ce mot n'apparaît pas dans les sources).`;

    const hasSystem = fullMessages.some((m) => m.role === "system");
    const messagesForProvider: ChatMessage[] = hasSystem
      ? fullMessages
      : [{ role: "system", content: systemPromptText }, ...fullMessages];

    const modelProvider = getModelProvider(provider);
    const activeProviderName = modelProvider.providerType || provider || "default";

    const stream = modelProvider.streamChat({
      messages: messagesForProvider,
      model,
      abortSignal: req.signal,
    });

    const encoder = new TextEncoder();
    let assistantFullText = "";
    let totalTokens = 0;

    const readable = new ReadableStream({
      async start(controller) {
        // Send initial metadata event with threadId and provider
        const initEvent = JSON.stringify({ event: "thread", threadId, provider: activeProviderName }) + "\n";
        controller.enqueue(encoder.encode(`data: ${initEvent}\n`));

        try {
          for await (const chunk of stream) {
            if (chunk.text) {
              assistantFullText += chunk.text;
              const textEvent = JSON.stringify({ event: "text", text: chunk.text }) + "\n";
              controller.enqueue(encoder.encode(`data: ${textEvent}\n`));
            }
            if (chunk.totalTokens) {
              totalTokens = chunk.totalTokens;
            }
          }

          // Persist completed assistant message
          if (assistantFullText.length > 0) {
            await messageRepo.create({
              threadId: threadId!,
              role: "assistant",
              content: assistantFullText,
              metadata: {
                provider: activeProviderName,
                model: model || "default",
                tokenCount: totalTokens,
                latencyMs: Date.now() - start,
              },
            });
          }

          const doneEvent = JSON.stringify({ event: "done", threadId, totalTokens }) + "\n";
          controller.enqueue(encoder.encode(`data: ${doneEvent}\n`));
          controller.close();

          logger.info("Chat stream completed", {
            requestId,
            userId: user.id,
            threadId,
            provider: activeProviderName,
            latencyMs: Date.now() - start,
            status: 200,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Erreur pendant la génération";
          const errEvent = JSON.stringify({ event: "error", error: errorMsg }) + "\n";
          controller.enqueue(encoder.encode(`data: ${errEvent}\n`));
          controller.close();

          logger.error("Error during chat stream", {
            requestId,
            userId: user.id,
            threadId,
            provider: activeProviderName,
            error: errorMsg,
          });
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "x-thread-id": threadId,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: err.message } },
        { status: 403 }
      );
    }
    if (err instanceof ThreadNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 }
      );
    }
    if (err instanceof MistralAuthenticationError) {
      return NextResponse.json(
        { error: { code: "MISTRAL_AUTH_ERROR", message: err.message } },
        { status: 401 }
      );
    }
    if (err instanceof MistralRateLimitError) {
      return NextResponse.json(
        { error: { code: "MISTRAL_RATE_LIMIT", message: err.message } },
        { status: 429 }
      );
    }
    if (err instanceof MistralTimeoutError || err instanceof OllamaTimeoutError) {
      return NextResponse.json(
        { error: { code: "TIMEOUT", message: err.message } },
        { status: 504 }
      );
    }
    if (err instanceof MistralAPIError) {
      return NextResponse.json(
        { error: { code: "MISTRAL_API_ERROR", message: err.message } },
        { status: err.statusCode || 500 }
      );
    }
    if (err instanceof OllamaUnavailableError) {
      return NextResponse.json(
        { error: { code: "OLLAMA_UNAVAILABLE", message: err.message } },
        { status: 503 }
      );
    }
    if (err instanceof ModelNotFoundError) {
      return NextResponse.json(
        { error: { code: "MODEL_NOT_FOUND", message: err.message } },
        { status: 404 }
      );
    }

    logger.error("Chat endpoint failure", { requestId, error: String(err) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Échec du service de chat" } },
      { status: 500 }
    );
  }
}
