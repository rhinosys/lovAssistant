## Purpose

Gives the association the means to honour GDPR requests on content indexed from Framateam, and guarantees that removed content is not indexed again.

## ADDED Requirements

### Requirement: Remove a message from the index
The system SHALL let an admin remove a message from the index by post id or permalink, from the admin area or a CLI command.

#### Scenario: Remove a reply
- **WHEN** an admin removes a reply by its permalink
- **THEN** the thread's chunks are rebuilt without that reply and the reply is never indexed again

#### Scenario: Remove a root post
- **WHEN** an admin removes a root post
- **THEN** all chunks of that thread are deleted and the thread is never indexed again

### Requirement: Remove a channel from the index
The system SHALL let an admin remove all indexed content of a channel and SHALL disable its indexing.

#### Scenario: Remove channel
- **WHEN** an admin removes a channel from the index
- **THEN** all its chunks are deleted, its indexing flag is disabled and its sync state is reset

### Requirement: Tombstones survive syncs
Removed posts SHALL be recorded so that later initial loads or incremental syncs never re-index them.

#### Scenario: Full reload after removal
- **WHEN** a channel is re-enabled and fully reloaded after a message was removed
- **THEN** the removed message is not present in the index

### Requirement: Removal is effective immediately
Removed content SHALL no longer be returned as evidence to any answer once the removal completes.

#### Scenario: Question after removal
- **WHEN** a question that previously retrieved a removed thread is asked again
- **THEN** that thread is not among the cited sources
