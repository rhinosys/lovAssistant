## Purpose

Establishes core security controls, input validation boundaries, secret containment policies, and structured audit logging across backend interfaces.

## ADDED Requirements

### Requirement: Server-side secret and network isolation
The system SHALL ensure that backend credentials, database secrets, and inference endpoints remain isolated on the server side and are never delivered to the client browser or exposed publicly.

#### Scenario: Inspecting client application bundles and network calls
- **WHEN** a client browser loads the web application and inspects network traffic and JavaScript assets
- **THEN** no database connection strings, session secrets, or direct Ollama network addresses are present in client bundles or network responses

#### Scenario: Direct external access to Ollama prevented
- **WHEN** an external network client attempts to contact Ollama directly through the web port
- **THEN** the application proxy routes requests strictly through validated application endpoints and does not expose a raw reverse proxy to Ollama

### Requirement: Input validation and payload bounds
The system SHALL validate all incoming API payloads using strict schema definitions, rejecting malformed structures and messages exceeding bounded maximum character limits.

#### Scenario: User submits excessively large message
- **WHEN** a client sends a message payload exceeding the configured maximum character length (e.g. 10,000 characters)
- **THEN** the backend rejects the request immediately with an HTTP 400 Bad Request error before invoking the model

### Requirement: Structured operational and security audit logging
The system SHALL produce structured JSON logs containing operational fields (requestId, userId, threadId, timestamp, model, latency, status, errorType) while strictly masking passwords, authorization headers, and raw session tokens.

#### Scenario: API request logging
- **WHEN** an authenticated chat request completes or fails
- **THEN** the system logs a structured JSON entry containing standard contextual metadata without logging raw authentication credentials or secret headers

### Requirement: Independent backend policy enforcement against prompt injection
The system SHALL enforce authorization policies independently in backend code so that instructions or commands embedded within untrusted user or retrieved text cannot trigger unauthorized actions or bypass application security rules.

#### Scenario: Malicious prompt attempting privilege escalation
- **WHEN** a user message contains prompt injection instructions attempting to bypass security boundaries or invoke administrative actions
- **THEN** backend authorization checks strictly reject unauthorized operations regardless of LLM generation output
