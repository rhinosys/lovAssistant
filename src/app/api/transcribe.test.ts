import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as handleTranscribe } from "./transcribe/route";
import { setForceInMemoryRepositories, getUserRepository } from "@/server/persistence";
import { setModelProvider } from "@/server/model/ollama";
import {
  MistralAuthenticationError,
  MistralRateLimitError,
  MistralTimeoutError,
  MistralAPIError,
} from "@/server/model/types";

function requestWithAudio(userId: string, audio: Blob | null): NextRequest {
  const form = new FormData();
  if (audio) {
    form.append("audio", audio, "recording.webm");
  }
  return new NextRequest("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "x-user-id": userId },
    body: form,
  });
}

describe("Transcription API (/api/transcribe)", () => {
  beforeEach(() => {
    setForceInMemoryRepositories(true);
  });

  it("returns the transcribed text as JSON on success", async () => {
    const userRepo = getUserRepository();
    const user = await userRepo.createOrFind("voice_user");

    setModelProvider(
      {
        providerType: "mistral",
        async *streamChat() {
          yield { text: "", done: true };
        },
        async checkHealth() {
          return { healthy: true, latencyMs: 1 };
        },
        async checkModelAvailability() {
          return true;
        },
        async transcribeAudio() {
          return "comment demarrer la decoupeuse laser";
        },
      } as never,
      "mistral"
    );

    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const res = await handleTranscribe(requestWithAudio(user.id, audio));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("comment demarrer la decoupeuse laser");
  });

  it("rejects a request with no audio file", async () => {
    const userRepo = getUserRepository();
    const user = await userRepo.createOrFind("voice_user_empty");

    const res = await handleTranscribe(requestWithAudio(user.id, null));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    [MistralAuthenticationError, 401, "MISTRAL_AUTH_ERROR"],
    [MistralRateLimitError, 429, "MISTRAL_RATE_LIMIT"],
    [MistralTimeoutError, 504, "TIMEOUT"],
  ] as const)("maps %s to HTTP %i", async (ErrorClass, expectedStatus, expectedCode) => {
    const userRepo = getUserRepository();
    const user = await userRepo.createOrFind(`voice_user_${expectedCode}`);

    setModelProvider(
      {
        providerType: "mistral",
        async *streamChat() {
          yield { text: "", done: true };
        },
        async checkHealth() {
          return { healthy: true, latencyMs: 1 };
        },
        async checkModelAvailability() {
          return true;
        },
        async transcribeAudio() {
          throw new ErrorClass("boom");
        },
      } as never,
      "mistral"
    );

    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const res = await handleTranscribe(requestWithAudio(user.id, audio));
    expect(res.status).toBe(expectedStatus);
    const data = await res.json();
    expect(data.error.code).toBe(expectedCode);
  });

  it("maps a generic MistralAPIError to its own status code", async () => {
    const userRepo = getUserRepository();
    const user = await userRepo.createOrFind("voice_user_apierror");

    setModelProvider(
      {
        providerType: "mistral",
        async *streamChat() {
          yield { text: "", done: true };
        },
        async checkHealth() {
          return { healthy: true, latencyMs: 1 };
        },
        async checkModelAvailability() {
          return true;
        },
        async transcribeAudio() {
          throw new MistralAPIError("upstream failed", 502);
        },
      } as never,
      "mistral"
    );

    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const res = await handleTranscribe(requestWithAudio(user.id, audio));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error.code).toBe("MISTRAL_API_ERROR");
  });
});
