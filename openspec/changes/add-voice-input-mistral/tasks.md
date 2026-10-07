## 1. Mistral provider: transcription method

- [x] 1.1 Add `transcribeAudio(audio: Blob | Buffer, fileName: string): Promise<string>` to `MistralProvider` in `src/server/model/mistral.ts`, posting multipart form data (`model=voxtral-mini-latest`, `file=<audio>`) to `${this.baseUrl}/audio/transcriptions`, reusing the class's existing `apiKey`/`baseUrl` fields — verify with a unit test in `src/server/model/mistral.test.ts` that mocks `fetch` and asserts the request URL, method, and multipart body shape.
- [x] 1.2 Map Mistral's transcription error responses to the existing typed errors (`MistralAuthenticationError` on 401, `MistralRateLimitError` on 429, `MistralTimeoutError` on request timeout, `MistralAPIError` for other non-2xx) — verify with unit tests covering each status code path.
- [x] 1.3 Handle an empty/whitespace-only transcription result by returning an empty string (not throwing) so the caller can decide how to surface "nothing understood" — verify with a unit test asserting empty string in, empty string out, no exception.

## 2. Server route: POST /api/transcribe

- [x] 2.1 Create `src/app/api/transcribe/route.ts` following the auth pattern in `src/app/api/chat/route.ts` (`authService.authenticateRequest`), accepting a multipart/form-data request with an `audio` field, and returning `{ text: string }` JSON on success — verify by adding a test to a new `src/app/api/transcribe.test.ts` (mirroring the structure of `src/app/api/api.test.ts`) that posts a fake audio blob and asserts the JSON shape.
- [x] 2.2 Wire the route to call `getModelProvider("mistral").transcribeAudio(...)` (reusing `src/server/model/registry.ts`'s existing provider lookup) and map thrown Mistral errors to HTTP status codes the same way `/api/chat/route.ts` already does (401/429/504/etc.) — verify with tests asserting each error path returns the expected status code.
- [x] 2.3 Confirm no audio bytes are written to disk, logs, or the database anywhere in the route (read the request body into memory, forward it, discard it) — verify by grepping the route for any `fs.writeFile`/`messageRepo`/persistence call touching the audio payload; there should be none.

## 3. Composer UI: microphone control

- [x] 3.1 Add a microphone button to the composer in `src/app/chat/page.tsx`, feature-detected via `typeof window.MediaRecorder !== "undefined" && navigator.mediaDevices?.getUserMedia` — verify by manually testing in a browser dev tools session with `MediaRecorder` deleted from `window`, confirming the button does not render.
- [x] 3.2 Implement the `idle → recording → transcribing → idle | error` state machine described in `design.md`: clicking while idle requests mic permission and starts `MediaRecorder`; clicking while recording stops it and triggers upload — verify by manually recording a short phrase and observing the button's visual state change through each phase.
- [x] 3.3 On stop, POST the recorded `Blob` to `/api/transcribe` via `apiUrl("/api/transcribe")` (consistent with the existing `apiUrl()` usage for other fetch calls in this file) as `multipart/form-data`, and on success set the composer's existing text input state to the returned text — verify manually that a real recording's transcribed text appears in the input, editable, and is not sent automatically.
- [x] 3.4 Handle and surface the three failure scenarios from the spec inline near the composer (without blocking text input): microphone permission denied, transcription API error, empty/inaudible result — verify manually by denying mic permission once, and by temporarily pointing the fetch at a non-existent endpoint once, confirming each shows a distinct inline message and the text composer remains usable.

## 5. Live audio-level feedback (added after manual verification surfaced a UX gap)

- [x] 5.1 Add a Web Audio `AnalyserNode` fed from the recording `MediaStream` in `src/app/chat/page.tsx`, sampling the input level on a `requestAnimationFrame` loop while `voiceState === "recording"` — verify by logging sampled levels to the console during a manual recording and confirming they rise/fall with speech.
- [x] 5.2 Render an animated level indicator (small bars or waveform) next to the mic button while recording, replacing the static red square icon — verify visually that the indicator reacts in real time to speaking vs. silence.
- [x] 5.3 Stop and disconnect the `AnalyserNode`/animation loop on `stopRecording` (and on any error path) so no animation frame callbacks leak after recording ends — verify by checking no console warnings/leaked RAF loop after several start/stop cycles.
- [x] 5.4 Re-run `npm test` and `npm run build` to confirm no regressions from this addition.

## 4. Verification

- [x] 4.1 Run the full test suite (`npm test`) and confirm all existing tests plus the new transcription tests pass with no regressions.
- [x] 4.2 Run `npm run build` (not just `npx tsc --noEmit` — this project has previously shipped a type error that only Next's stricter build-time check caught) and confirm it completes with no type errors.
- [ ] 4.3 Manually verify end-to-end in the dev server (`npm run dev`): record a real voice message asking a FabLab question, confirm the transcribed text populates the composer, edit it, send it, and confirm the chat responds normally — matching every scenario in `specs/chat/voice-input/spec.md`.
