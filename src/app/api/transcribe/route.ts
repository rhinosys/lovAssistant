import { NextRequest, NextResponse } from "next/server";
import { authService, AuthorizationError } from "@/server/auth/session";
import { getModelProvider } from "@/server/model";
import { MistralProvider } from "@/server/model/mistral";
import {
  MistralAuthenticationError,
  MistralRateLimitError,
  MistralTimeoutError,
  MistralAPIError,
} from "@/server/model";
import { logger } from "@/server/observability/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}`;

  try {
    const user = await authService.authenticateRequest(req.headers);

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Corps de requête multipart/form-data invalide" } },
        { status: 400 }
      );
    }

    const audio = formData.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Aucun fichier audio fourni" } },
        { status: 400 }
      );
    }

    // Voxtral (transcription) is Mistral-only — reuse the same registry singleton as chat,
    // typed to the concrete provider only for this one extra method.
    const provider = getModelProvider("mistral") as MistralProvider;
    const fileName = audio instanceof File && audio.name ? audio.name : "recording.webm";
    const text = await provider.transcribeAudio(audio, fileName);

    logger.info("Audio transcription completed", {
      requestId,
      userId: user.id,
      textLength: text.length,
    });

    return NextResponse.json({ text });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: err.message } },
        { status: 403 }
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
    if (err instanceof MistralTimeoutError) {
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

    logger.error("Transcription endpoint failure", { requestId, error: String(err) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Échec de la transcription audio" } },
      { status: 500 }
    );
  }
}
