## 1. Foundation & YesWiki HTTP Client

- [x] 1.1 Add `@modelcontextprotocol/sdk` and HTTP client dependencies to package.json and verify dependency installation.
- [x] 1.2 Implement YesWiki HTTP client (`src/server/mcp/yeswiki-client.ts`) supporting raw page retrieval, search endpoints, and Bazar JSON queries. Verify unit tests with mocked YesWiki server.
- [x] 1.3 Implement text cleaning and wikitext/HTML parser utilities (`src/server/mcp/parsers.ts`). Verify unit tests convert raw wikitext to clean readable text with section headers.

## 2. Page Reading & Search Tools

- [x] 2.1 Implement `yeswiki_search_pages` tool returning matching pages with excerpts and canonical URLs. Verify unit tests against mock search results.
- [x] 2.2 Implement `yeswiki_get_page` tool extracting cleaned content, author, modification date, and canonical link. Verify unit tests for existing and missing pages.
- [x] 2.3 Implement `yeswiki_list_recent_changes` tool parsing the wiki recent changes feed. Verify unit tests validate chronological ordering.

## 3. Bazar Form & Machine Directory Tools

- [x] 3.1 Implement `yeswiki_get_bazar_entries` tool parsing structured Bazar forms and categories. Verify unit tests validate field extraction.
- [x] 3.2 Implement `yeswiki_get_machine_status` tool extracting operational state, maintenance logs, and guide links for fablab machines. Verify unit tests against sample machine cards.

## 4. Two-Step Write Operations & Approval Tokens

- [x] 4.1 Implement token signing utility (`src/server/mcp/tokens.ts`) issuing HMAC-SHA256 tokens with 5-minute expiration and content hashing. Verify unit tests for token verification and expiration rejection.
- [x] 4.2 Implement `yeswiki_prepare_page_update` tool generating unified line diffs and confirmation tokens without modifying live wiki. Verify unit tests assert diff generation.
- [x] 4.3 Implement `yeswiki_apply_page_update` tool committing changes to YesWiki only when valid confirmation token and operator signature are supplied. Verify unit tests confirm commit behavior and rejection of invalid tokens.

## 5. MCP Resources & Multi-Transport Server

- [x] 5.1 Implement MCP resource providers (`yeswiki://page/{name}`, `yeswiki://bazar/machines`, `yeswiki://recent-changes`). Verify resource read operations.
- [x] 5.2 Implement MCP server entrypoint (`src/server/mcp/server.ts`) supporting both `stdio` and `SSE` HTTP transports. Verify server initializes and advertises tool/resource catalog.

## 6. Security, Prompt Injection & Audit Logging

- [x] 6.1 Implement structured JSON audit logging for all MCP tool calls and write operations. Verify logs mask authentication secrets.
- [x] 6.2 Enforce input validation and data containment policies ensuring retrieved wiki text cannot trigger unauthorized tool execution. Verify automated security tests.

## 7. Verification & AdminLova Integration

- [x] 7.1 Implement backend MCP client connection in AdminLova to discover and invoke YesWiki MCP tools. Verify integration tests.
- [x] 7.2 Execute complete test suite and verify end-to-end tool calling with YesWiki mock environment.

