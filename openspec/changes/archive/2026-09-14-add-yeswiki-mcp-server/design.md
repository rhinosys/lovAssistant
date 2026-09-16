## Context

The fablab utilizes YesWiki (`https://labovilleurbanne.fr/yeswiki/`) as its central collaborative knowledge base and machine inventory system (via the Bazar extension). To enable the AI Assistant (`AdminLova`) to reliably search documentation, answer member questions with verifiable citations, and prepare structured wiki edits, this change designs and implements a dedicated Model Context Protocol (MCP) server for YesWiki.

See `proposal.md` for motivation and capability scope.

## Goals / Non-Goals

**Goals:**
- Implement a standards-compliant MCP server using `@modelcontextprotocol/sdk` in TypeScript.
- Provide high-fidelity YesWiki reading tools (`yeswiki_search_pages`, `yeswiki_get_page`, `yeswiki_list_recent_changes`).
- Support structured Bazar form queries (`yeswiki_get_bazar_entries`, `yeswiki_get_machine_status`).
- Enforce a 2-step write confirmation model (`yeswiki_prepare_page_update` → `yeswiki_apply_page_update`) requiring explicit human approval.
- Expose live MCP resources for dynamic wiki document inspection.
- Maintain complete server-side credential isolation and defenses against prompt injection.

**Non-Goals:**
- Creating a replacement web UI for YesWiki.
- Direct database (SQL) manipulation of YesWiki tables.
- Bypassing YesWiki access control lists (ACLs).
- Unmoderated or automated bulk editing of wiki pages without human confirmation.

## Decisions

### 1. Technology & Protocol Architecture
- **Decision**: Build the server in TypeScript using `@modelcontextprotocol/sdk` and `zod` for tool schema validation.
- **Rationale**: Direct alignment with the AdminLova TypeScript stack, full type safety, and seamless support for both `stdio` and `SSE` transport layers.
- **Alternatives Considered**:
  - *Python FastMCP*: Would introduce a Python runtime dependency into a pure TypeScript application.
  - *Direct REST API wrapper in frontend*: Violates security boundaries and prevents cross-assistant MCP reuse.

### 2. Component Layout & Architecture

```text
AdminLova Backend (or AI Client)
       │
       │ JSON-RPC 2.0 (stdio or SSE)
       ▼
YesWiki MCP Server
  ├── Protocol Engine (@modelcontextprotocol/sdk)
  ├── Tool Handlers (Search, GetPage, Bazar, Prepare/Apply Write)
  ├── Resource Providers (yeswiki://...)
  ├── Security & Token Manager (HMAC Signed Confirmation Tokens)
  └── YesWiki HTTP Client (Cookie / Session & HTML/Raw Parsers)
       │
       │ HTTPS Requests
       ▼
Fablab YesWiki (https://labovilleurbanne.fr/yeswiki/)
```

**Directory Layout**:
```text
mcp-server-yeswiki/          # (or src/server/mcp/server/)
  src/
    client/
      yeswiki-client.ts     # HTTP client for YesWiki API, raw text & Bazar
      parsers.ts            # HTML to clean Markdown/plaintext & diff generator
    tools/
      search-pages.ts       # yeswiki_search_pages
      get-page.ts           # yeswiki_get_page
      recent-changes.ts     # yeswiki_list_recent_changes
      bazar.ts              # yeswiki_get_bazar_entries & get_machine_status
      write-page.ts         # yeswiki_prepare_page_update & apply_page_update
    resources/
      page-resource.ts      # yeswiki://page/{name}
      bazar-resource.ts     # yeswiki://bazar/machines
    security/
      tokens.ts             # HMAC-SHA256 confirmation tokens
      audit.ts              # Structured JSON audit logging
    server.ts               # MCP Server entry point & transport setup
```

### 3. YesWiki HTTP Integration Strategy
- **Raw Page Retrieval**: Calls `?{page_name}/raw` or `?wiki={page_name}&format=raw` to obtain original wikitext, stripping template noise.
- **Bazar Queries**: Calls `?BazarAPI` or `?{bazar_page}/json` to retrieve structured JSON records.
- **Search & Changes**: Parses `?RechercheTexte&phrase={q}` and `?DerniersChangements/rss.xml` for structured metadata.
- **Authentication**: Stores `YESWIKI_COOKIE` / session secrets in backend `.env` variables; credentials never leave the server process.

### 4. Two-Step Safe Write Workflow
1. **Prepare Phase (`yeswiki_prepare_page_update`)**:
   - Compares live wiki text with proposed content.
   - Computes unified diff.
   - Issues an HMAC-SHA256 confirmation token: `payload = { pageName, contentHash, expiresAt: now + 300s }`.
   - Returns diff and token to caller without touching YesWiki.
2. **Apply Phase (`yeswiki_apply_page_update`)**:
   - Validates cryptographic signature and checks that `expiresAt > now`.
   - Re-verifies content hash against token payload.
   - Submits authenticated POST request to YesWiki.
   - Records audit log entry with operator identity and new revision URL.

### 5. Prompt Injection Defense
- Wiki content is treated strictly as data payloads.
- No text extracted from wiki pages is executed or interpreted as system-level instructions.
- Write operations cannot be triggered by LLM generation alone; execution strictly blocks until the human user supplies the valid confirmation token.

## Risks / Trade-offs

- **[Risk: YesWiki template variations or custom themes break HTML scraping]** → **Mitigation**: Prioritize raw wikitext endpoints (`/raw`) and dedicated JSON endpoints over HTML scraping.
- **[Risk: Network latency when fetching large wiki pages]** → **Mitigation**: Implement 5-second request timeouts and lightweight in-memory caching with short TTL (60s) for recent changes and search results.
- **[Risk: Expired confirmation token causes user friction]** → **Mitigation**: Return clear, helpful error messages prompting the assistant to regenerate a fresh preview token if 5 minutes elapse.

## Migration Plan

1. Develop and unit-test MCP server tools with mocked YesWiki responses.
2. Configure `.env` with `YESWIKI_BASE_URL=https://labovilleurbanne.fr/yeswiki/`.
3. Test stdio execution via MCP inspector / CLI.
4. Integrate MCP client into AdminLova backend in Phase 3.
