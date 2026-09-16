# OpenSpec Prompt — Mistral AI API Integration

## Purpose

Use this prompt with OpenSpec to specify, design, and implement the connection between **assistant-ui** / the **AdminLova backend** and the **Mistral AI API** using the API token configured in `.env`.

The preferred workflow is:

```text
/opsx:propose connect-mistral-api
```

Then paste the prompt below.

> Important: this OpenSpec change is for **planning and specification first**.  
> Do **not** implement code until the proposal, specs, design, and tasks have been reviewed and the user explicitly starts `/opsx:apply`.

---

# PROMPT TO GIVE TO OPENSPEC

We want to integrate the **Mistral AI API** as a supported inference provider in **AdminLova**, connecting our `@assistant-ui/react` interface and Next.js backend to Mistral models (e.g. `mistral-small-latest`, `mistral-large-latest`, `codestral-latest`, `open-mistral-7b`) alongside the existing local Ollama provider.

The user has already added their API token in `.env` (e.g. `MISTRAL_API_KEY=...`).

Create an OpenSpec change named:

```text
connect-mistral-api
```

Use the default **spec-driven** workflow and produce complete planning artifacts:

```text
openspec/changes/connect-mistral-api/
├── proposal.md
├── specs/
│   ├── config/environment-schema/
│   ├── model/mistral-provider/
│   ├── model/provider-registry/
│   ├── api/chat-streaming/
│   └── ui/provider-model-selector/
├── design.md
└── tasks.md
```

Do not implement anything yet until the proposal and specs are approved.

---

## 1. Product Objective

AdminLova is designed for fablab assistance with conversational chat, grounded wiki retrieval, and administrative tools. While local inference (Ollama) is available, enabling Mistral AI as a cloud provider offers:

1. **High Quality & Speed**: Fast, high-quality responses in French with Mistral's latest models.
2. **Hybrid / Flexible Deployment**: Allow running locally via Ollama when on LAN, or via Mistral API when remote, when local hardware is underpowered, or when higher reasoning capability is required.
3. **Seamless assistant-ui Experience**: Maintain real-time streaming, thread persistence, token counting, and error handling seamlessly in `@assistant-ui/react` and custom chat components.

---

## 2. Technical Scope & Architecture

### 2.1 Configuration (`src/server/config.ts` & `.env`)
- Extend the Zod configuration schema with:
  - `MISTRAL_API_KEY`: string (optional in local-only mode, required when provider is `mistral`).
  - `MISTRAL_MODEL`: default `mistral-small-latest` (configurable e.g. `mistral-large-latest`, `codestral-latest`, `open-mistral-7b`).
  - `MISTRAL_BASE_URL`: default `https://api.mistral.ai/v1`.
  - `DEFAULT_LLM_PROVIDER`: `ollama` | `mistral` (default `ollama` or auto-detected if `MISTRAL_API_KEY` is present).
- Update `.env.example` with clear documentation and placeholder comments.

### 2.2 Model Provider Abstraction (`src/server/model/`)
- Implement `MistralProvider` conforming to `ChatModelProvider` (`src/server/model/types.ts`):
  - `streamChat(options: ChatOptions): AsyncIterable<ChatStreamChunk>`: Call Mistral's `/v1/chat/completions` endpoint with `stream: true`, parse Server-Sent Events (`data: {...}`), extract delta text and token statistics, and yield standard `ChatStreamChunk`.
  - `checkHealth(): Promise<OllamaHealthStatus>` (or generic `ModelProviderHealthStatus`): Validate connectivity and API key validity against Mistral API (`/v1/models`).
  - `checkModelAvailability(modelName: string): Promise<boolean>`: Verify model support.
- Custom Errors:
  - `MistralAuthenticationError` (401 - Invalid/missing API key)
  - `MistralRateLimitError` (429 - Quota or rate limit exceeded)
  - `MistralAPIError` (500/502/503 - Upstream API failure)
  - `MistralTimeoutError` (504 - Request timeout)
- Provider Factory & Registry (`src/server/model/index.ts` / `registry.ts`):
  - Support getting provider by name (`getModelProvider("mistral")` or `getModelProvider("ollama")`).
  - Fallback mechanism if the requested provider is unavailable.

### 2.3 Backend API Streaming (`src/app/api/chat/route.ts`)
- Extend `chatRequestSchema` to accept optional `provider: "ollama" | "mistral"` and specific `model`.
- Resolve the appropriate provider dynamically based on request parameters or server configuration.
- Persist message metadata indicating `provider: "mistral"`, `model`, `tokenCount`, and `latencyMs` in PostgreSQL.
- Stream SSE events cleanly to the client with identical contract (`event: thread`, `event: text`, `event: done`, `event: error`).

### 2.4 Frontend Integration (`src/app/chat/` & `@assistant-ui/react`)
- Add a Model & Provider Selector in the chat interface:
  - Toggle or dropdown to switch between **Ollama (Local)** and **Mistral AI (Cloud)**.
  - Model selection list (e.g. `mistral-small-latest`, `mistral-large-latest`, `qwen2.5:7b`).
- UI Status & Feedback:
  - Indicator pill showing active provider (e.g. "Mistral AI" with a cloud/sparkle icon vs "Ollama" with a server icon).
  - Clear user-facing error banners for common issues (e.g., "Clé API Mistral invalide ou quota dépassé").
  - Retain full compatibility with conversation history, thread sidebar, and future wiki citation cards.

### 2.5 Security Principles
1. **Server-Side Key Isolation**: `MISTRAL_API_KEY` must never be exposed to the client bundle or sent in client-side headers. All calls to Mistral API are strictly handled server-side in Next.js route handlers.
2. **Safe Error Masking**: Never return raw authorization headers or secret values in API error payloads.
3. **Data Governance / Privacy Notice**: Inform fablab users when queries are routed to an external cloud API versus processed on local LAN.

---

## 3. Non-Goals for this Change

- Changing the PostgreSQL thread/message schema incompatibly.
- Replacing the assistant-ui components with a completely different UI library.
- Removing or disabling local Ollama support (both must co-exist cleanly).

---

## 4. Expected Planning Artifacts

1. **`proposal.md`**: Motivation, user scenarios, architectural impact, dependencies.
2. **`specs/`**:
   - `config/environment-schema`: Zod validation, env loading, safe defaults.
   - `model/mistral-provider`: Mistral REST/SSE client, chunk normalization, token usage extraction, error translation.
   - `model/provider-registry`: Multi-provider factory, health checks, provider resolution.
   - `api/chat-streaming`: Request schema updates, SSE streaming pass-through, metadata persistence.
   - `ui/provider-model-selector`: Provider switcher, model picker, provider status badges, error notifications.
3. **`design.md`**:
   - Provider interface architecture.
   - Sequence diagram for chat streaming with Mistral API.
   - Error handling matrix (401, 429, 500, timeout).
4. **`tasks.md`**:
   - Step-by-step implementation tasks with Vitest unit tests (mocking Mistral API responses and streaming SSE).

---

## 5. Acceptance Criteria

1. Setting `MISTRAL_API_KEY` in `.env` enables Mistral API inference without crashes or missing variable errors.
2. The user can chat with Mistral models in the assistant UI with real-time token streaming and smooth rendering.
3. Errors (e.g., bad API key, rate limit, offline network) display descriptive French error notifications in the UI without server crashes.
4. The user can seamlessly switch between Ollama (Local) and Mistral AI (Cloud).
5. All automated unit tests in `src/server/model/mistral.test.ts` and `src/server/config.test.ts` pass with 100% mocked external calls.
