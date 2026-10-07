## Why

Adhérents at the FabLab often ask questions with their hands busy at a machine (laser cutter, 3D printer) and typing on the chat composer is impractical. Mistral now offers a hosted transcription model (Voxtral) compatible with the OpenAI transcription API shape, and the app already holds a `MISTRAL_API_KEY` for chat — adding voice input reuses that same credential instead of introducing a new vendor or a browser-only speech API with inconsistent cross-browser support (Web Speech API works reliably only in Chromium browsers).

## What Changes

- Add a microphone button to the chat composer (`src/app/chat/page.tsx`) that records audio via the browser's `MediaRecorder` API.
- Add a new server route `POST /api/transcribe` that accepts the recorded audio, forwards it to Mistral's transcription endpoint (`POST https://api.mistral.ai/v1/audio/transcriptions`, model `voxtral-mini-latest`), and returns the transcribed text. The Mistral API key stays server-side, consistent with how `/api/chat` already proxies Mistral chat completions.
- Add a `transcribeAudio` method to the Mistral provider module (`src/server/model/mistral.ts`) alongside the existing chat-completion method, sharing the same config/error-handling conventions (`MistralAuthenticationError`, `MistralRateLimitError`, `MistralTimeoutError`, `MistralAPIError`).
- Transcribed text populates the composer's text input for the user to review and edit before sending — it is never sent automatically, and no audio is persisted (transcribed in-memory, discarded after the response).
- Graceful degradation: if the browser lacks `MediaRecorder`/microphone permission, or the transcription call fails, show an inline error and leave the existing text-only composer fully usable.

## Capabilities

### New Capabilities
- `chat/voice-input`: lets a user record speech in the chat composer and have it transcribed into editable text via Mistral's Voxtral model, without sending the message automatically or persisting audio.

### Modified Capabilities
(none — the existing chat/composer behavior is unchanged when voice input is not used, and no existing spec covers the composer today)

## Impact

- **Frontend**: `src/app/chat/page.tsx` (composer UI, mic button, recording state, calling the new endpoint via `apiUrl()`), a new small component or inline handler for the recording UI state (idle / recording / transcribing / error).
- **Backend**: new `src/app/api/transcribe/route.ts`; new method on `src/server/model/mistral.ts`; no changes to `src/server/model/ollama.ts` (Voxtral is Mistral-only, no local equivalent is in scope).
- **Config**: no new environment variables — reuses the existing `MISTRAL_API_KEY`/`MISTRAL_BASE_URL`.
- **Dependencies**: none new on the server (uses `fetch` + `FormData`, already used elsewhere in the codebase); browser-native `MediaRecorder`, no new client library.
- **Cost**: Voxtral is billed per minute of audio (Mistral's usage-based pricing) — out of scope for this proposal to add spend limits/monitoring; noted as a follow-up if usage grows.
