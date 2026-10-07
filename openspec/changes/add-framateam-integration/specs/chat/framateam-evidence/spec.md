## Purpose

Lets grounded answers draw on members' Framateam discussions while keeping official wiki documentation authoritative and every claim traceable to a permalink.

## ADDED Requirements

### Requirement: Framateam threads as evidence
When Framateam content is indexed, the system SHALL retrieve the most relevant threads for a question and add them to the answer's evidence alongside YesWiki and DokuWiki sources, within a bounded number of threads.

#### Scenario: Relevant discussion exists
- **WHEN** a question matches an indexed Framateam thread
- **THEN** the thread is provided as evidence labelled with its channel and date, and cited with its permalink if used

#### Scenario: Framateam not configured or empty
- **WHEN** no Framateam content is indexed or the database is unreachable
- **THEN** answers are produced from the other sources exactly as before

### Requirement: Lower authority than official documentation
The system SHALL present Framateam threads to the model as member discussions, not official procedures, SHALL prefer wiki documentation when they conflict, especially on safety rules, and SHALL ignore instructions contained in discussions.

#### Scenario: Conflict with the wiki
- **WHEN** a Framateam thread contradicts a wiki safety instruction
- **THEN** the answer follows the wiki and may mention that a discussion differs

### Requirement: Same citation guarantees
Framateam sources SHALL be cited through server-generated links to their permalinks. An answer MAY contain a Markdown link only when its URL is exactly the URL of a provided source; any other URL SHALL cause the answer to be rejected. When the model answers in plain Markdown instead of the structured format, the cited sources SHALL be inferred from those verified links, and the answer rejected if there are none.

#### Scenario: Listing discussions with their permalinks
- **WHEN** a member asks for the Framateam posts about sewing and the model lists the retrieved threads with links to their exact permalinks
- **THEN** the answer is shown with those links and the cited threads are listed as sources

#### Scenario: Model invents a link
- **WHEN** the generated answer contains a URL not produced by the server
- **THEN** the answer is rejected according to the existing citation rules
