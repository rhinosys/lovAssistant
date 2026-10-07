## Purpose

Turns the discussions of selected Framateam public channels into anonymised, per-thread searchable chunks, kept up to date incrementally without overloading the shared Framasoft instance.

## ADDED Requirements

### Requirement: Only selected public channels are ingested
The system SHALL ingest only channels that are public (type open) and enabled for indexing by an admin.

#### Scenario: Private channel
- **WHEN** a channel is private or a direct/group message channel
- **THEN** none of its posts are fetched for indexing, even if the account is a member

#### Scenario: Channel not enabled
- **WHEN** a public channel is not enabled for indexing
- **THEN** none of its posts are fetched for indexing

### Requirement: Initial load
The system SHALL load the full history of a newly enabled channel with paginated requests of at most 200 posts and SHALL be able to resume after an interruption.

#### Scenario: Interrupted initial load
- **WHEN** the initial load of a channel stops after some pages
- **THEN** the next run continues the load and the final index contains each thread once

### Requirement: Incremental sync
After the initial load the system SHALL fetch only posts created, edited or deleted since the last stored timestamp of each channel, and SHALL refresh the affected threads.

#### Scenario: New reply in an indexed thread
- **WHEN** a reply is posted in an already indexed thread
- **THEN** the next sync re-indexes that thread including the reply

#### Scenario: Edited post
- **WHEN** a post of an indexed thread is edited
- **THEN** the next sync replaces the thread's chunks with the edited content

#### Scenario: Deleted post
- **WHEN** a post of an indexed thread is deleted in Framateam
- **THEN** the next sync removes its content from the index (the whole thread if the root is deleted)

### Requirement: Per-thread anonymised chunks
The system SHALL build chunks per thread (root post and its replies in chronological order), SHALL NOT include author names, usernames or mentions of members in indexed content, and SHALL skip threads without useful content.

#### Scenario: Mentions and authors
- **WHEN** a thread contains `@alice` mentions and posts by several members
- **THEN** indexed content contains neither author names nor usernames, mentions are replaced by a neutral placeholder

#### Scenario: Short or empty thread
- **WHEN** a thread contains only short acknowledgements, emoji, system messages or text below the configured minimum length
- **THEN** it is not indexed

#### Scenario: Assistant's own posts
- **WHEN** a thread contains posts written by the assistant's account
- **THEN** those posts are excluded from indexed content

#### Scenario: Long thread
- **WHEN** a thread exceeds the chunk size
- **THEN** it is split into several chunks, each starting with the root post content

### Requirement: Chunk metadata
Each chunk SHALL carry the channel, the thread date and a permalink `https://framateam.org/<team>/pl/<root_post_id>`.

#### Scenario: Permalink
- **WHEN** a thread with root post `abc123` of team `lov` is indexed
- **THEN** its chunks reference `https://framateam.org/lov/pl/abc123`

### Requirement: Gentle use of the shared instance
The system SHALL serialise API calls, space them, honour HTTP 429 `Retry-After` and rate-limit headers, back off exponentially on server and network errors, and SHALL NOT sync more often than the configured interval (minimum 15 minutes, default 60).

#### Scenario: Rate limited
- **WHEN** the API answers 429 with `Retry-After: 30`
- **THEN** no further request is sent for at least 30 seconds and the sync then resumes

### Requirement: Session handling
The system SHALL authenticate with the configured user account and SHALL re-authenticate once and retry when a request returns 401.

#### Scenario: Expired session
- **WHEN** a request returns 401 because the session token expired
- **THEN** the client logs in again and the request is retried once; a second 401 fails the sync with an authentication error
