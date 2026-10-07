## Context

`MistralProvider` (`src/server/model/mistral.ts`) already wraps chat completions with `apiKey`/`baseUrl`/`defaultModel` read from `getConfig()`, and throws typed errors (`MistralAuthenticationError`, `MistralRateLimitError`, `MistralTimeoutError`, `MistralAPIError`) that `/api/chat/route.ts` maps to HTTP status codes. The composer (`src/app/chat/page.tsx`) is a client component that already calls server routes through the `apiUrl()` helper (added for basePath support) rather than raw `fetch("/api/...")`. See `proposal.md` for why voice input is being added and why Voxtral over the Web Speech API.

## Goals / Non-Goals

**Goals:**
- Reuse the existing Mistral provider's config and error-handling conventions for the new transcription call, rather than a parallel, divergent implementation.
- Keep the browser-side recording logic simple and dependency-free (native `MediaRecorder`, no new npm package).
- Fail closed to the existing text-only composer on any unsupported browser or API failure.

**Non-Goals:**
- Real-time/streaming transcription (Voxtral Realtime) — this change only uses the batch transcription endpoint (`voxtral-mini-latest`) on a complete recording, not live partial transcripts while speaking.
- Speaker diarization, word-level timestamps, or any other Voxtral feature beyond plain text output.
- An Ollama/local equivalent — Voxtral is Mistral-only; when the user's selected provider is Ollama, the mic button still transcribes via Mistral (transcription is independent of which provider will answer the resulting text message).
- Audio format transcoding on the server — the browser records in a format Voxtral accepts directly (see Decisions).

## Decisions

**Recording format: browser records `audio/webm` (Opus) via `MediaRecorder`, sent as-is.**
`MediaRecorder`'s default mime type on Chromium/Firefox is `audio/webm;codecs=opus`; Safari (16.4+) supports `audio/mp4`. Mistral's transcription endpoint (OpenAI-compatible `audio/transcriptions`) accepts common container formats including webm and mp4/m4a, so no client-side or server-side transcoding is needed — the server route just forwards whatever `Blob` the browser produced, using the browser-reported MIME type to name the file in the multipart upload. Alternative considered: force a specific format (e.g. always re-encode to wav) for uniformity — rejected as unnecessary complexity; Voxtral's format tolerance makes it unneeded, and pulling in an encoding library would be the first new client dependency for a feature that doesn't need one.

**New method on `MistralProvider` vs. a separate module.**
Add `transcribeAudio(audio: Blob | Buffer, fileName: string): Promise<string>` to the existing `MistralProvider` class rather than a standalone function, so it shares `apiKey`/`baseUrl` and the existing typed-error throwing pattern used by `streamChat`/`checkHealth`. Alternative considered: a free function in a new `src/server/model/transcription.ts` — rejected because it would duplicate the config-reading and error-mapping already on the class for no isolation benefit (there's only one provider that can transcribe).

**New route `POST /api/transcribe` vs. reusing `/api/chat`.**
A dedicated route keeps the request/response shape simple (multipart audio in, `{ text: string }` out) and avoids overloading `/api/chat`'s streaming SSE contract with a fundamentally different, non-streaming operation. It follows the same auth pattern as other routes under `src/app/api/*` (session auth via `authService`, consistent with `/api/threads` and `/api/chat`).

**No audio persistence.**
The route reads the multipart body, forwards it to Mistral in-memory, and returns the text — nothing is written to disk or to Postgres. This matches the proposal's privacy requirement and avoids adding storage/cleanup concerns for a feature that doesn't need audio history.

**Client recording state machine: `idle → recording → transcribing → idle | error`.**
A single local state enum in the composer component covers the mic button's visual state (icon/color) and disables the text input's send action only while `transcribing` (not while `recording`, so the user could in principle keep an existing draft). Kept local to the component — no new global state store — since voice input is a self-contained interaction that ends by writing into the same text state the composer already manages.

## Risks / Trade-offs

- **Browser compatibility gaps** (older Safari, some mobile browsers lack `MediaRecorder` or microphone access over non-HTTPS) → Mitigation: feature-detect `MediaRecorder`/`navigator.mediaDevices.getUserMedia` before showing the mic button; hide it (not just disable it) when unsupported, so the composer looks unchanged on unsupported browsers.
- **Per-minute Voxtral cost could grow with usage** → Mitigation: none built into this change (explicitly a non-goal per the proposal's Impact section); flagged as a follow-up if usage monitoring is later needed.
- **Background noise in a FabLab environment degrading transcription quality** → Mitigation: none at the transcription layer (out of scope); the requirement that transcribed text is editable before sending (see spec) is the main safety net — a bad transcription just gets corrected or discarded by the user, never sent silently.
- **Large recordings increasing request latency/timeout risk** → Mitigation: not addressed by a hard duration cap in this change; the existing `MistralTimeoutError` path already surfaces a clear error if a request takes too long, which is treated as sufficient for a chat-composer use case (short utterances, not long dictation).

## Migration Plan

No migration — purely additive (new route, new provider method, new UI control). No existing behavior changes when the mic button is not used. No feature flag: the mic button's own feature-detection is the rollout gate (browsers/environments without support simply never show it).
