## Why

The Fablab AI assistant (`AdminLova`) currently defaults to local inference via Ollama. While local inference is ideal for low-cost LAN operations, fablab operators and users require a reliable, high-performance cloud alternative when local hardware is underpowered, offline, or when more complex reasoning and fast French conversational capabilities are desired. Integrating the **Mistral AI API** enables seamless hybrid AI orchestration while keeping sensitive credentials securely on the server.

## What Changes

- Add support for **Mistral AI API** as a first-class inference provider alongside local Ollama.
- Introduce `MistralProvider` conforming to `ChatModelProvider` with Server-Sent Events (SSE) streaming, token counting, and custom error translation (401 invalid key, 429 quota/rate limit, 504 timeout).
- Extend server configuration (`src/server/config.ts`) and environment schema (`.env.example`) with `MISTRAL_API_KEY`, `MISTRAL_MODEL`, and `DEFAULT_LLM_PROVIDER`.
- Create a multi-provider registry and factory (`src/server/model/registry.ts`) to dynamically route chat requests to either Ollama or Mistral.
- Update `/api/chat` endpoint to accept provider and model selection and record provider metadata with conversation messages in PostgreSQL.
- Enhance the `@assistant-ui/react` chat UI (`src/app/chat/`) with a provider/model selector toggle and status badge (Local vs Mistral Cloud).

## Capabilities

### New Capabilities
- `model/mistral-provider`: Integration with Mistral AI REST API for streaming chat completions, token accounting, and standardized error translation.
- `model/provider-registry`: Multi-provider routing, health verification, and dynamic provider resolution between Ollama and Mistral.
- `ui/provider-model-selector`: UI provider and model selector in the chat interface with visual status badges and provider-specific error handling.

### Modified Capabilities
<!-- None: No existing specs for model providers or chat UI exist in openspec/specs/. -->

## Impact

- **Affected Code**:
  - `src/server/config.ts`: Added Mistral environment variables to Zod schema.
  - `src/server/model/`: New `mistral.ts`, `registry.ts`, and updated `types.ts`.
  - `src/app/api/chat/route.ts`: Updated request validation schema and provider dispatching.
  - `src/app/chat/page.tsx`: Added provider/model selection controls and UI feedback.
  - `.env.example`: Documented `MISTRAL_API_KEY`, `MISTRAL_MODEL`, and `DEFAULT_LLM_PROVIDER`.
- **Dependencies**: No external npm SDK strictly required (implements standard native `fetch` over Mistral REST API with SSE parsing).
- **Security**: `MISTRAL_API_KEY` is kept strictly server-side and never exposed to the client browser.
