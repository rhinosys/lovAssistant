## Purpose

Manages relational persistence of user conversations, thread records, and individual message histories in PostgreSQL with extensible metadata support and lifecycle management.

## ADDED Requirements

### Requirement: Persistent relational storage of threads and messages
The system SHALL persist all user conversations, threads, and messages in PostgreSQL so that data remains accessible across server and container restarts.

#### Scenario: Messages survive application restart
- **WHEN** a user exchanges messages in a thread and the backend application service is restarted
- **THEN** querying the thread after restart returns the exact historical messages, roles, contents, and timestamps

#### Scenario: Message ordering preservation
- **WHEN** multiple messages are stored in a thread over time
- **THEN** the system retrieves messages in strict chronological order based on creation sequence

### Requirement: Thread lifecycle and title management
The system SHALL support creating, renaming, listing, and deleting conversation threads for an authenticated user.

#### Scenario: User lists personal threads
- **WHEN** an authenticated user requests their conversation history
- **THEN** the system returns a paginated or ordered list of threads owned by that user, sorted by most recent activity

#### Scenario: User deletes a thread
- **WHEN** an authenticated user deletes one of their threads
- **THEN** the system removes the thread and cascades deletion to all associated messages and metadata, removing it from subsequent listings

### Requirement: Extensible metadata schema for future phases
The system SHALL store messages with a JSONB or structured metadata field designed to support future citation sources, retrieved chunk identifiers, tool calls, approval statuses, and audit correlation IDs.

#### Scenario: Storing message with metadata payload
- **WHEN** a message is persisted by the backend
- **THEN** the record includes standard fields (id, thread_id, role, content, created_at) along with an extensible metadata object containing model name, token usage metrics, and correlation identifiers
