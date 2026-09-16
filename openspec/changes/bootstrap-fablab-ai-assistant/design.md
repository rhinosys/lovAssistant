## Context

The fablab requires an open-source, low-cost, self-hosted AI assistant that runs on local hardware using an existing Ollama installation. The platform must offer an intuitive chat interface in French, ensure strict user conversation isolation, persist all interactions in PostgreSQL, and maintain clean separation of concerns for future wiki RAG (Phase 2) and MCP administrative automation (Phase 3).

See `proposal.md` for project motivation and high-level scope.

## Goals / Non-Goals

**Goals:**
- Deliver a responsive web chat application using `assistant-ui` and a TypeScript / Node.js backend.
- Abstract local LLM inference behind a robust `ChatModelProvider` that interacts with Ollama over private local networking without cloud fallback.
- Store users, threads, and messages in PostgreSQL with migrations and extensible JSONB metadata.
- Enforce strict server-side authorization ensuring users cannot access, view, or alter other users' conversation threads.
- Standardize configuration loading, structured JSON logging, and health/readiness probe endpoints.
- Provide a simple Docker Compose deployment configuration connecting the app to PostgreSQL and host-level Ollama.

**Non-Goals:**
- Implementing wiki ingestion, chunking, or document crawlers (deferred to Phase 2).
- Implementing vector search, embeddings storage, or rerankers in Phase 1.
- Implementing MCP client transports, tool schemas, or administrative actions (deferred to Phase 3).
- Adding complex enterprise IAM or multi-tenant organizations in this bootstrap phase.
- Introducing Kubernetes, distributed message brokers, or external vector databases.

## Decisions

### 1. Unified TypeScript Stack with Next.js & assistant-ui
- **Decision**: Use Next.js (App Router) with TypeScript to house both the `assistant-ui` React frontend and server-side API endpoints (`/api/chat`, `/api/threads`, `/api/health`).
- **Rationale**: Keeps the codebase cohesive in a single language, eliminates unnecessary inter-process network overhead for UI-to-backend calls, simplifies deployment to a single container plus PostgreSQL, and provides first-class support for `assistant-ui` and streaming responses.
- **Alternatives Considered**:
  - *Separate Python (FastAPI) backend + React frontend*: Added multi-language maintenance burden and duplicate type definitions without clear benefit for Phase 1.
  - *Standalone Express API + Vite SPA*: Required separate build pipelines and CORS configurations without providing meaningful architectural advantages over Next.js API routes.

### 2. Provider Abstraction for Local Ollama Inference
- **Decision**: Introduce a `ChatModelProvider` interface with a concrete `OllamaProvider` communicating with Ollama's HTTP API (or pinned Vercel AI SDK Ollama integration).
- **Rationale**: Ensures the rest of the application remains completely decoupled from Ollama specifics, enables mocking in automated tests without GPU requirements, and enforces the strict rule of no cloud LLM fallback.
- **Alternatives Considered**:
  - *Direct LangChain / LlamaIndex integration*: Rejected due to high abstraction complexity, opaque prompt handling, and unnecessary dependencies.
  - *Direct browser-to-Ollama requests*: Violates security boundaries, exposes Ollama to the network, and prevents server-side conversation persistence and authorization.

### 3. Relational Persistence with PostgreSQL
- **Decision**: Use PostgreSQL with a standard migration tool (such as Drizzle ORM or Prisma) to manage `users`, `threads`, and `messages` tables, using `JSONB` columns for extensible metadata.
- **Rationale**: PostgreSQL offers rock-solid ACID reliability for conversation persistence and serves as the single storage engine that will cleanly support `pgvector` in Phase 2 without introducing a separate vector database.
- **Alternatives Considered**:
  - *SQLite*: Lacks easy multi-user concurrent write scaling and future pgvector hybrid search capabilities.
  - *Dedicated Vector DB (Qdrant/Milvus/Chroma)*: Premature for Phase 1 and adds operational complexity for a small team.

### 4. Component Structure & Architecture Flow

```text
Browser (assistant-ui)
      │
      │ HTTP / Server-Sent Events (SSE)
      ▼
Next.js App Server (Security Boundary)
  ├── Auth Middleware (/api/auth, Session check)
  ├── Thread Router (/api/threads - Ownership validation)
  ├── Chat Router (/api/chat - Request validation & streaming)
  └── Observability (/api/health, Structured Logger)
        │
        ├── PostgreSQL (Users, Threads, Messages + metadata)
        │
        └── OllamaProvider (HTTP Client)
              │
              ▼ (Private Bridge / host.docker.internal:11434)
            Ollama Instance (Host GPU/CPU)
```

**Directory Layout**:
```text
src/
  app/                      # Next.js App Router (Pages, UI, API Routes)
    api/
      auth/                 # Session & authentication handlers
      chat/                 # Chat streaming endpoints
      health/               # Liveness and readiness probes
      threads/              # Thread management CRUD endpoints
    chat/                   # Assistant-ui page components
  server/
    auth/                   # Identity verification & session tokens
    chat/                   # Conversation service & ownership policies
    model/                  # ChatModelProvider & OllamaProvider
    persistence/            # PostgreSQL schemas, migrations, repositories
    observability/          # Structured logger, metrics, error handlers
```

### 5. Data Model

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nouvelle conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_threads_user_id ON threads(user_id);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
```

### 6. Security & Authorization Model
- **Backend as Security Boundary**: All authorization checks happen on the server. The client never receives database credentials, Ollama endpoints, or administrative secrets.
- **Ownership Verification**: Every query to `/api/threads/[id]` or `/api/chat` validates `thread.user_id === session.user_id`. Unmatched requests receive `404 Not Found` or `403 Forbidden`.
- **Input Bounding**: Payloads are parsed with Zod, limiting prompt length to 10,000 characters and validating UTF-8 encoding.
- **Prompt Injection Defense Principle**: Instructions embedded in user input, future wiki texts, or future tool responses are treated strictly as data. The LLM has zero authority to execute administrative actions directly; all execution policy is handled by backend validation.

### 7. Deployment & Local Networking
- Docker Compose orchestrates `app` and `postgres` containers.
- The `app` container communicates with the host-installed Ollama via `host.docker.internal:11434` (or host gateway).
- Ollama is never exposed to external interfaces.
- Persistent PostgreSQL volume `postgres_data` guarantees durability.

## Risks / Trade-offs

- **[Risk: Host Ollama network resolution differs between OS platforms (macOS/Linux)]** → **Mitigation**: Configure `extra_hosts: ["host.docker.internal:host-gateway"]` in `docker-compose.yml` and provide configurable `OLLAMA_BASE_URL` in `.env`.
- **[Risk: Slow token generation on CPU-only machines]** → **Mitigation**: Support configurable model tags in `.env` (e.g. `qwen2.5:3b` or `qwen2.5:7b-instruct-q4_K_M`) so operators can choose appropriate quantization for their hardware.
- **[Risk: Streaming connection drops mid-generation]** → **Mitigation**: Implement `AbortController` signaling to cancel Ollama generation upon client disconnect, preventing orphaned inference processes.
- **[Risk: Future schema migration conflicts with pgvector]** → **Mitigation**: Use PostgreSQL base images that include pgvector extensions (e.g. `pgvector/pgvector:pg16`), ensuring smooth Phase 2 activation without database migration downtime.

## Migration Plan

1. Create PostgreSQL database and apply initial schema migrations (`users`, `threads`, `messages`).
2. Populate `.env` from `.env.example` with valid `DATABASE_URL` and `OLLAMA_BASE_URL`.
3. Verify local Ollama reachability via `/api/health/ready`.
4. Launch application via `npm run dev` or `docker compose up -d`.
5. Rollback strategy: Schema changes are backward-compatible; database rollbacks are handled via ORM migration down scripts.

## Open Questions

- *Exact production hardware profile (CPU vs GPU VRAM)*: Kept configurable via `OLLAMA_MODEL` and timeout settings in `.env`.
- *Final authentication provider (Keycloak / Authentik / LDAP)*: PoC authentication is decoupled behind `AuthService` interface, making future OIDC integration straightforward.
