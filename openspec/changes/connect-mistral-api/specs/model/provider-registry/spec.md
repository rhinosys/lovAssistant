## Purpose

Provides unified resolution, routing, and fallback between multiple LLM inference providers including local Ollama and cloud Mistral AI.

## ADDED Requirements

### Requirement: Dynamic Provider Resolution
The system SHALL resolve the appropriate `ChatModelProvider` instance based on explicit request parameters or system default configuration.

#### Scenario: Request with explicit Mistral provider
- **WHEN** a client request specifies `provider: "mistral"`
- **THEN** the registry returns the `MistralProvider` instance

#### Scenario: Request with default provider fallback
- **WHEN** a client request does not specify a provider
- **THEN** the registry returns the configured default provider (`DEFAULT_LLM_PROVIDER` or auto-detected default)

#### Scenario: Unknown provider requested
- **WHEN** a client request specifies an unsupported provider name
- **THEN** the system rejects the request with a 400 Bad Request error indicating supported providers

### Requirement: Provider Metadata Recording
The system SHALL persist the provider identifier, specific model name, and token usage with the assistant message metadata in the database.

#### Scenario: Metadata recorded upon stream completion
- **WHEN** an assistant response generation finishes successfully
- **THEN** the persisted message metadata includes `provider`, `model`, `tokenCount`, and `latencyMs`
