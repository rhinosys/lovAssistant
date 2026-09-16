## Why

The fablab requires a self-hosted, cost-effective, and privacy-preserving AI assistant capable of serving local conversational interactions in French without relying on cloud LLM dependencies. This change bootstraps the technical foundation and Phase 1 (local conversational chat) with local Ollama inference, conversation persistence, strict user isolation, and structured backend security boundaries, while laying out clean extension points for subsequent wiki RAG (Phase 2) and MCP administrative automation (Phase 3).

## What Changes

This change introduces the core application platform and Phase 1 functionality:
- **Assistant Web Interface**: Modern, responsive chat UI built with `assistant-ui` supporting streamed responses in French, conversation management, error/loading states, and UI slots ready for future citation and tool-approval cards.
- **Node.js / TypeScript Backend**: Application server orchestrating authentication, request validation, conversation lifecycle, local model invocation, and operational telemetry.
- **Local Ollama Provider Abstraction**: Dedicated model provider interface isolating local Ollama runtime communications without cloud fallback.
- **Relational Persistence**: PostgreSQL schema and migrations for users, threads, and messages with extensible metadata support.
- **Identity and User Isolation**: Pluggable authentication layer with strict server-side ownership enforcement to prevent unauthorized cross-user thread access.
- **Security & Operational Boundaries**: Server-side configuration management, secret isolation from client bundles, structured operational logging, health/readiness endpoints, and Docker Compose local deployment orchestration.
- **Non-Goals / Excluded from Phase 1**: Remote wiki ingestion/crawling, vector embeddings/search, document citation rendering, real MCP tool execution, cloud LLM fallback, LangChain/LlamaIndex frameworks, and Kubernetes deployments.

## Capabilities

### New Capabilities
- `chat/local-chat`: Web chat interface powered by assistant-ui with streamed conversational generation in French, thread navigation, loading states, and error handling.
- `chat/conversation-persistence`: PostgreSQL persistence for threads and messages with ownership association and extensible metadata for future RAG/MCP stages.
- `identity/user-isolation`: Basic authenticated identity boundary enforcing server-side ownership and complete isolation between user sessions and conversation histories.
- `ai/ollama-provider`: Server-side LLM provider abstraction communicating strictly with a private local Ollama instance without cloud fallback.
- `operations/configuration`: Validated server-side environment configuration with startup failure on invalid or missing required variables and `.env.example` templates.
- `operations/health-and-errors`: Health/readiness checks for application dependencies (PostgreSQL, Ollama) and standardized structured error responses.
- `operations/local-deployment`: Docker Compose orchestration topology for app and PostgreSQL with private network integration to host Ollama.
- `security/application-boundaries`: Strict backend security boundary preventing client secret exposure, validating all inputs, isolating Ollama from public access, and recording structured audit logs.

### Modified Capabilities
<!-- No existing capabilities are being modified as this is the initial project bootstrap. -->

## Impact

- **New Codebase Structure**: Bootstraps full-stack TypeScript project with Next.js/Node.js, `assistant-ui`, PostgreSQL client/migrations, and Docker Compose definitions.
- **Dependencies**: Introduces React, `assistant-ui`, Vercel AI SDK (or native Ollama HTTP adapter), PostgreSQL driver / ORM (e.g. Drizzle or Prisma), Zod, and Docker.
- **APIs**: Exposes `/api/auth/*`, `/api/chat/*`, `/api/threads/*`, and `/api/health` endpoints.
- **Infrastructure & Network**: Requires running PostgreSQL container and local network connectivity to an existing host Ollama service on port 11434. No public exposure of Ollama.
