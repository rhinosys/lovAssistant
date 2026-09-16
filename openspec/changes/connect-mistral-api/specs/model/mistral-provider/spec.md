## Purpose

Enables streaming chat generation, model health checks, and standardized error mapping against the Mistral AI API for the Fablab AI Assistant.

## ADDED Requirements

### Requirement: Mistral Chat Stream Generation
The system SHALL stream chat completion tokens from the Mistral AI API given a list of conversation messages and a model identifier.

#### Scenario: Successful streaming response
- **WHEN** a valid chat request is sent with Mistral as the provider
- **THEN** the system streams chunks of generated text in real-time as Server-Sent Events until generation completes

#### Scenario: Missing or invalid API key
- **WHEN** a chat request is processed without a valid `MISTRAL_API_KEY`
- **THEN** the system aborts the stream and returns a standardized 401 Authentication Error

#### Scenario: Rate limit or quota exceeded
- **WHEN** the Mistral API returns an HTTP 429 status code
- **THEN** the system terminates the request and returns a standardized 429 Rate Limit Error with retry guidance

### Requirement: Mistral Health and Availability Check
The system SHALL verify connectivity and credential validity against the Mistral AI API.

#### Scenario: Healthy Mistral API check
- **WHEN** health check is requested and the Mistral API returns a 200 response
- **THEN** the system reports the provider as healthy along with measured round-trip latency

#### Scenario: Unreachable Mistral API
- **WHEN** the Mistral API network request times out or is unreachable
- **THEN** the system reports the provider as unhealthy with descriptive diagnostic details
