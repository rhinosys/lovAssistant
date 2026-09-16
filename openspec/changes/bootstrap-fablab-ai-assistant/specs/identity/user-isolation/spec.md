## Purpose

Establishes an isolated authentication and authorization boundary ensuring that user conversations and sensitive resources are strictly partitioned and accessible only to their authenticated owners.

## ADDED Requirements

### Requirement: User authentication and session establishment
The system SHALL provide an authentication mechanism to verify user identity and establish authenticated sessions, abstracted from core conversation logic so it can later be replaced with external OIDC providers.

#### Scenario: Successful user authentication
- **WHEN** a user provides valid credentials or session token
- **THEN** the system issues an authenticated session associating subsequent requests with the user's unique identifier

#### Scenario: Unauthenticated request rejection
- **WHEN** an unauthenticated client attempts to access thread APIs or chat streaming endpoints
- **THEN** the system returns an HTTP 401 Unauthorized status and blocks data processing

### Requirement: Server-side thread ownership enforcement
The system SHALL verify thread ownership on the server side for every read, write, update, and delete operation, rejecting any unauthorized access.

#### Scenario: User attempts to access another user's thread
- **WHEN** User B attempts to read or send a message to a thread owned by User A (using User A's thread identifier)
- **THEN** the system rejects the request with an HTTP 403 Forbidden or HTTP 404 Not Found error and does not reveal thread contents or metadata

#### Scenario: User lists threads
- **WHEN** User A queries the thread list endpoint
- **THEN** the returned dataset contains only threads owned by User A and strictly excludes threads owned by other users
