## 1. Application Foundation & Configuration

- [x] 1.1 Initialize Next.js TypeScript project structure, dependencies (`assistant-ui`, React, Lucide icons, Zod, PostgreSQL client/ORM, Vitest), and verify `npm run build` succeeds.
- [x] 1.2 Implement server-side environment configuration loader (`src/server/config.ts`) with Zod validation, `.env.example` template, and fail-fast startup behavior. Verify unit tests validate missing vs. valid configurations.
- [x] 1.3 Implement structured JSON logging utility (`src/server/observability/logger.ts`) with correlation request IDs and secret/credential masking. Verify unit tests ensure sensitive headers and passwords are never logged.

## 2. PostgreSQL Persistence & Schema

- [x] 2.1 Create PostgreSQL database schemas and migration scripts for `users`, `threads`, and `messages` (including JSONB metadata column). Verify migrations execute successfully against PostgreSQL.
- [x] 2.2 Implement repository data access layer (`src/server/persistence/`) for thread and message lifecycle operations. Verify integration tests validate CRUD operations and chronological message retrieval.

## 3. Authentication & User Isolation

- [x] 3.1 Implement session identity management service (`src/server/auth/`) providing pluggable authentication tokens/cookies. Verify unit tests confirm valid session issuance and unauthenticated request rejection.
- [x] 3.2 Implement server-side thread ownership authorization policy (`src/server/chat/ownership.ts`). Verify integration tests assert User B is rejected with 403/404 when attempting to access User A's thread.

## 4. Local Ollama Provider Abstraction

- [x] 4.1 Implement `ChatModelProvider` interface and `OllamaProvider` (`src/server/model/ollama.ts`) interfacing with local Ollama HTTP API with zero cloud fallback. Verify unit tests with mocked Ollama HTTP stream.
- [x] 4.2 Implement error handlers for Ollama unreachable (503), missing model tag (404), and generation timeout/stream cancellation via AbortController. Verify unit tests assert error mappings and abort signal propagation.

## 5. Chat & Streaming Backend API

- [x] 5.1 Implement chat streaming route (`/api/chat`) with Zod input validation (10,000 char bounds), thread ownership enforcement, Ollama token streaming, and automatic message persistence. Verify API integration test streams tokens and records messages in database.
- [x] 5.2 Implement thread management endpoints (`/api/threads`, `/api/threads/[id]`) for listing, fetching, updating titles, and deleting threads under strict user isolation. Verify API integration tests enforce ownership on all operations.

## 6. assistant-ui Web Interface

- [x] 6.1 Integrate `assistant-ui` chat interface in French (`src/app/chat/`) with streaming token rendering, loading indicators, and graceful error banners. Verify UI displays conversation components.
- [x] 6.2 Implement conversation sidebar for creating new threads, switching between past conversations, and deleting threads. Verify UI interacts with `/api/threads` endpoints.
- [x] 6.3 Implement retry/regeneration mechanism on failed messages and prepare extensible message slots for future citation badges and MCP approval cards. Verify retry behavior.

## 7. Operations, Observability & Docker Deployment

- [x] 7.1 Implement `/api/health` and `/api/health/ready` probe endpoints verifying PostgreSQL and Ollama reachability. Verify endpoint returns 200 when healthy and 503 with dependency diagnostics when down.
- [x] 7.2 Create `docker-compose.yml` orchestrating `app` and `postgres` services with pgvector-compatible image, persistent volume storage, and `host.docker.internal` bridge to host Ollama. Verify `docker compose config` validation passes.
- [x] 7.3 Create setup documentation and operational runbook (`README.md`) detailing prerequisites, environment variable configuration, migration steps, and local launch instructions.

## 8. Final Acceptance & Verification

- [x] 8.1 Run complete automated test suite validating user isolation, conversation persistence across restart, Ollama error handling, and input validation bounds. Verify 100% test pass rate.
- [x] 8.2 Perform manual end-to-end acceptance verification of Phase 1 requirements (French chat, streaming, persistence, isolation, no cloud fallback) against the acceptance criteria.
