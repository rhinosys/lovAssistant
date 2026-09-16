## Purpose

Encapsulates local large language model inference behind a dedicated provider abstraction communicating exclusively with a private local Ollama instance without cloud fallback.

## ADDED Requirements

### Requirement: Model provider abstraction for local Ollama
The system SHALL isolate all model inference behind a server-side `ChatModelProvider` abstraction implemented by an `OllamaProvider` that interfaces with the local Ollama HTTP API.

#### Scenario: Server-side model invocation
- **WHEN** the chat backend receives a validated prompt stream request
- **THEN** the backend invokes the local Ollama provider, formats the message history, and consumes the raw stream before transforming it for the client

#### Scenario: No cloud provider fallback
- **WHEN** the local Ollama service encounters an error or delay
- **THEN** the system fails cleanly and SHALL NOT initiate fallback requests to any external or cloud-hosted AI APIs

### Requirement: Controlled handling of Ollama service unavailability
The system SHALL detect when the local Ollama instance is unreachable and return a controlled, structured error to the caller.

#### Scenario: Ollama service is stopped or unreachable
- **WHEN** the backend attempts to initiate generation while the Ollama endpoint is down or connection is refused
- **THEN** the provider intercepts the network error, terminates the request, and yields an explicit error indicating that the local inference engine is unavailable

### Requirement: Missing or invalid model error reporting
The system SHALL validate the availability of the configured model name and provide explicit error messaging when the requested model is not found in the local Ollama library.

#### Scenario: Configured model is not installed in Ollama
- **WHEN** the backend requests generation for a model tag that does not exist in the local Ollama installation
- **THEN** the system detects the 404/not-found response from Ollama and returns an explicit configuration error identifying the missing model name

### Requirement: Request timeout and stream cancellation
The system SHALL enforce server-side generation timeouts and gracefully cancel ongoing Ollama generation if the client disconnects or aborts the request.

#### Scenario: Client aborts active stream
- **WHEN** a user closes the browser tab or clicks stop during active generation
- **THEN** the backend signals an abort to the Ollama HTTP stream, releases the connection, and logs the aborted request
