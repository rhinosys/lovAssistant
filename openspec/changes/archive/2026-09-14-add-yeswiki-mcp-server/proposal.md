## Why

The Fablab AI assistant requires direct, structured, and auditable access to the lab's YesWiki knowledge base (`https://labovilleurbanne.fr/yeswiki/` and `https://yeswiki.net/`) to retrieve machine documentation, safety protocols, tutorials, and Bazar inventory cards, as well as to prepare verified wiki updates with explicit human confirmation. This change introduces a dedicated Model Context Protocol (MCP) server providing standardized tools, resources, and strict security controls for YesWiki operations.

## What Changes

This change introduces the YesWiki MCP Server component:
- **MCP Server Core**: Standalone TypeScript service implementing the Model Context Protocol over `stdio` (for direct backend spawning) and `Streamable HTTP / SSE` (for standalone network deployment).
- **YesWiki Reader Tools**: Standardized tools (`yeswiki_search_pages`, `yeswiki_get_page`, `yeswiki_list_recent_changes`) for querying wiki pages, extracting clean raw/markdown text, and generating verifiable canonical URLs.
- **Bazar Module Integration**: Tools (`yeswiki_get_bazar_entries`, `yeswiki_get_machine_status`) for querying structured form entries such as machine inventories, project fiches, and maintenance logs.
- **Two-Step Write Confirmation Workflow**: Safe write tools (`yeswiki_prepare_page_update`, `yeswiki_apply_page_update`) requiring unified diff previews, time-limited confirmation tokens, and explicit human approval before committing edits.
- **MCP Resources**: Live readable endpoints (`yeswiki://page/{page_name}`, `yeswiki://bazar/machines`, `yeswiki://recent-changes`) enabling the LLM to inspect live wiki documents directly.
- **Security & Prompt Injection Containment**: Server-side secret management (no credentials delivered to the model), input bounds, audit logging, and strict data-only treatment of wiki content to block prompt injection attacks.
- **Backend Client Integration**: Extension in the AdminLova backend to connect to the MCP server and present tools to conversational models.

## Capabilities

### New Capabilities
- `mcp/server-core`: Protocol lifecycle management, `stdio` and `SSE` transports, tool/resource discovery, and health diagnostics.
- `yeswiki/page-reader`: Page search, raw content extraction, metadata parsing (author, timestamp), canonical URL formatting, and recent change feeds.
- `yeswiki/bazar-reader`: Extraction and filtering of structured Bazar cards, machine directory entries, and project forms.
- `yeswiki/write-operations`: Two-stage prepare/preview/apply write operations with unified diffs, 5-minute confirmation tokens, and parameter validation.
- `security/authorization-and-audit`: Server-side credential isolation, structured audit logging, and prompt injection defense policies.

### Modified Capabilities
<!-- No existing capabilities modified -->

## Impact

- **New Subsystem**: Creates `mcp-server-yeswiki/` package (or `src/mcp/` module) using `@modelcontextprotocol/sdk`.
- **Dependencies**: Adds `@modelcontextprotocol/sdk`, `zod`, and HTTP client utilities.
- **External Integration**: Connects over HTTPS to `https://labovilleurbanne.fr/yeswiki/` and `https://yeswiki.net/`.
- **Security**: Ensures YesWiki session cookies and administrative API keys are stored only in server environment variables.
