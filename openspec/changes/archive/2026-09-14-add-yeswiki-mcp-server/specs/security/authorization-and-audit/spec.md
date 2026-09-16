## Purpose

Enforces server-side credential isolation, structured audit logging, and strict prompt injection defenses for YesWiki MCP interactions.

## ADDED Requirements

### Requirement: Server-side credential isolation
The system SHALL ensure that YesWiki administrative session cookies, authentication tokens, and API secrets remain exclusively on the server and are never delivered to the client browser or exposed in LLM prompts.

#### Scenario: Inspecting MCP tool call payloads and responses
- **WHEN** an MCP tool is called or returns data to the LLM
- **THEN** no administrative passwords, API keys, or raw cookie headers are visible in tool inputs, outputs, or error messages

### Requirement: Prompt injection defense and untrusted content containment
The server SHALL treat all text retrieved from YesWiki pages, comments, and Bazar forms as untrusted data, ensuring embedded instructions cannot escalate privileges or trigger write actions without explicit out-of-band user approval.

#### Scenario: Malicious instruction embedded in wiki page
- **WHEN** a retrieved wiki page contains text instructing the LLM to execute `yeswiki_apply_page_update` or delete content
- **THEN** the system prevents execution because no write operation can be committed without an authentic human confirmation token

### Requirement: Structured audit logging for tool operations
The server SHALL generate structured JSON audit logs for every tool call and write operation, recording timestamp, tool name, user identity, parameter hashes, latency, and success/failure status.

#### Scenario: Tool execution audit trail
- **WHEN** a read or write tool finishes execution
- **THEN** a structured log entry is recorded with the operator's identifier, request ID, execution latency, and outcome without logging sensitive credentials
