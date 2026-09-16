## Context

AdminLova currently routes all conversational inference to a local Ollama instance via `OllamaProvider` (implementing `ChatModelProvider`). The server API (`src/app/api/chat/route.ts`) streams tokens to the client over Server-Sent Events (SSE). We are introducing Mistral AI as a pluggable cloud provider while maintaining full compatibility with the existing persistence layer, error formats, and `@assistant-ui/react` frontend.

## Goals / Non-Goals

**Goals:**
- Implement `MistralProvider` conforming to `ChatModelProvider` supporting streaming chat completions (`/v1/chat/completions`) and model health verification (`/v1/models`).
- Provide a clean multi-provider registry (`src/server/model/registry.ts`) to resolve providers dynamically.
- Update Zod configuration in `src/server/config.ts` to validate Mistral settings (`MISTRAL_API_KEY`, `MISTRAL_MODEL`, `MISTRAL_BASE_URL`, `DEFAULT_LLM_PROVIDER`).
- Support provider and model switching from `@assistant-ui/react` in `src/app/chat/`.
- Ensure 100% test coverage with mocked API responses.

**Non-Goals:**
- Replacing or deprecating local Ollama support.
- Exposing the Mistral API key to the client application.
- Supporting non-chat endpoints (e.g. batch or audio endpoints) in this phase.

## Decisions

### 1. Native HTTP Client vs External Mistral SDK
- **Decision**: Implement `MistralProvider` using native `fetch` and a lightweight SSE stream reader rather than importing external SDKs.
- **Rationale**: Minimal bundle footprint, zero extra dependency risk, full native control over `AbortSignal` timeouts, and straightforward mocking in Vitest.
- **Alternatives Considered**:
  - `@mistralai/mistralai`: Official SDK, but introduces unnecessary transitive dependencies for standard SSE chat endpoints.
  - `@ai-sdk/mistral` with Vercel AI SDK: Would require rewriting our custom SSE streaming protocol and DB persistence pipeline.

### 2. Provider Registry & Factory Pattern
- **Decision**: Implement a central provider registry in `src/server/model/registry.ts`:
  ```ts
  export function getModelProvider(providerName?: "ollama" | "mistral"): ChatModelProvider
  ```
- **Rationale**: Decouples API routes from concrete provider implementations, allowing easy per-request overrides from the UI while respecting server default configurations.

### 3. Error Translation & Mapping Matrix
- **Decision**: Map Mistral HTTP errors to typed exceptions:
  - `401 Unauthorized` → `MistralAuthenticationError` (401)
  - `429 Too Many Requests` → `MistralRateLimitError` (429)
  - `504 Gateway Timeout / AbortSignal` → `MistralTimeoutError` (504)
  - Others → `MistralAPIError` (500)
- **Rationale**: Enables structured error handling in `/api/chat/route.ts` and precise, localized error feedback in the UI.

### 4. UI State & Model Selection
- **Decision**: Add a provider toggle and model selector in `src/app/chat/page.tsx` header/controls.
- **Rationale**: Gives operators immediate control over inference destination (e.g., local LAN privacy vs cloud model speed/reasoning).

## Risks / Trade-offs

- **[Risk: Secret Leakage]** → `MISTRAL_API_KEY` is loaded strictly in `src/server/config.ts` which is restricted to server-side Node.js execution. Next.js does not bundle non-`NEXT_PUBLIC_` variables to the client.
- **[Risk: Upstream Quota / Rate Limiting]** → Captured with HTTP 429 status code and presented as a polite banner advising retry or switching back to local Ollama.
- **[Risk: Streaming Interruptions / Disconnections]** → Standardized `AbortSignal` handling gracefully closes both the upstream Mistral fetch and the client SSE connection.
