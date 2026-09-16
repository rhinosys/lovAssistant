## Purpose

Provides observability, service readiness probes, and standardized error response contracts for operational monitoring and troubleshooting.

## ADDED Requirements

### Requirement: Health and readiness probe endpoints
The system SHALL expose `/api/health` and `/api/health/ready` endpoints reporting overall application status and individual dependency health (PostgreSQL and Ollama).

#### Scenario: All dependencies healthy
- **WHEN** a monitoring client issues a GET request to `/api/health/ready` and both PostgreSQL and Ollama are reachable
- **THEN** the system responds with HTTP 200 OK and a JSON body indicating status `ok` along with healthy statuses for `database` and `ollama`

#### Scenario: Database connection failure
- **WHEN** PostgreSQL is down or unreachable
- **THEN** the `/api/health/ready` endpoint returns HTTP 503 Service Unavailable with a JSON body indicating database failure while keeping sensitive connection strings hidden

#### Scenario: Ollama service failure
- **WHEN** Ollama is unreachable
- **THEN** the `/api/health/ready` endpoint returns HTTP 503 Service Unavailable detailing that the inference dependency is unavailable

### Requirement: Standardized error responses
The system SHALL return structured, machine-readable JSON error payloads containing consistent error codes, human-readable descriptions, and correlation request IDs across all API routes.

#### Scenario: Client encounters application error
- **WHEN** an API request fails due to validation, authentication, or downstream errors
- **THEN** the system responds with appropriate HTTP status code and a JSON body containing `error.code`, `error.message`, and `requestId` fields
