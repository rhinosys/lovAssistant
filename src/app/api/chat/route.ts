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
import { collectEvidence, evidencePrompt, renderEvidence, NO_EVIDENCE, printerInventoryEvidence } from "@/server/chat/grounding";

const chatRequestSchema = z.object({
  threadId: z.string().optional(),
  message: z
    .string()
    .min(1, "Le message ne peut pas être vide")
    .max(10000, "Le message ne peut pas dépasser 10 000 caractères"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
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

    // Prior assistant answers are not evidence, especially after a corrected hallucination.
    const userHistory = fullMessages.filter(item => item.role === "user").slice(-3);
    const sources = await collectEvidence(userHistory.map(item => item.content).join("\n"));
    const messagesForProvider: ChatMessage[] = [
      { role: "system", content: evidencePrompt(sources) },
      ...userHistory,
    ];

    const modelProvider = getModelProvider(provider);
    const activeProviderName = modelProvider.providerType || provider || "default";

    const inventory = printerInventoryEvidence(message, sources);
    const stream = inventory ? (async function* () { yield { text: inventory, totalTokens: 0 }; })() : sources.length ? modelProvider.streamChat({
      messages: messagesForProvider,
      model,
      abortSignal: req.signal,
      temperature: 0,
    }) : (async function* () { yield { text: '{"evidence":[]}', totalTokens: 0 }; })();

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
              if (assistantFullText.length > 30000) { assistantFullText = ""; break; }

            }
            if (chunk.totalTokens) {
              totalTokens = chunk.totalTokens;
            }
          }

          assistantFullText = sources.length ? renderEvidence(assistantFullText, sources) : NO_EVIDENCE;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "text", text: assistantFullText })}\n\n`));

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
