## Purpose

Implements the Model Context Protocol (MCP) server lifecycle, transport layers (stdio and SSE), and tool and resource registries for the YesWiki integration.

## ADDED Requirements

### Requirement: Multi-transport MCP server execution
The system SHALL support running the YesWiki MCP server over both standard input/output (`stdio`) and Server-Sent Events (`SSE` / HTTP) transports without code changes.

#### Scenario: Running MCP server over stdio
- **WHEN** the backend orchestrator spawns the YesWiki MCP server process with stdio transport
- **THEN** the server initializes JSON-RPC message handling on stdin/stdout and advertises supported capabilities

#### Scenario: Running MCP server over SSE HTTP
- **WHEN** an MCP client establishes an HTTP connection to the `/sse` endpoint
- **THEN** the server opens a streaming SSE session and provides a message POST URL for bidirectional communication

### Requirement: Tool and resource discovery
The server SHALL expose a standardized schema list of all available tools and readable resources to connected MCP clients upon receiving `tools/list` and `resources/list` requests.

#### Scenario: Client requests tool catalogue
- **WHEN** an MCP client issues a `tools/list` JSON-RPC request
- **THEN** the server returns JSON schemas for all available YesWiki reading, querying, and write-preparation tools

#### Scenario: Client requests resource catalogue
- **WHEN** an MCP client issues a `resources/list` JSON-RPC request
- **THEN** the server returns URI templates including `yeswiki://page/{page_name}`, `yeswiki://bazar/machines`, and `yeswiki://recent-changes`
