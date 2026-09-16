## Purpose

Manages two-phase wiki write operations requiring unified diff previews, time-limited confirmation tokens, and explicit human approval before committing changes.

## ADDED Requirements

### Requirement: Two-stage write preparation and preview
The tool `yeswiki_prepare_page_update` SHALL generate a unified diff comparing current wiki content with the proposed edit and issue a cryptographically signed, time-limited confirmation token (valid for 5 minutes).

#### Scenario: User prepares a page tutorial update
- **WHEN** the assistant invokes `yeswiki_prepare_page_update` with `page_name: "TutoFraiseuse"`, `new_content: "..."`, and `summary: "Ajout des vitesses de coupe"`
- **THEN** the server computes a line-by-line diff, generates an approval token bound to the exact content hash, and returns the preview without modifying the live wiki page

#### Scenario: Preparation for a new page creation
- **WHEN** `yeswiki_prepare_page_update` is called for a page that does not yet exist
- **THEN** the server marks the diff as a full addition (new page creation) and issues a creation confirmation token

### Requirement: Explicit confirmation and commit execution
The tool `yeswiki_apply_page_update` SHALL commit the prepared update to YesWiki only upon receiving a valid, unexpired confirmation token accompanied by the operator's user signature.

#### Scenario: Successful write execution with valid token
- **WHEN** `yeswiki_apply_page_update` is invoked with a valid token within 5 minutes of issuance
- **THEN** the server commits the edit to YesWiki with the appropriate user attribution and returns the new revision ID and updated page URL

#### Scenario: Rejection of expired or tampered confirmation token
- **WHEN** `yeswiki_apply_page_update` is invoked with an expired token or modified payload parameters
- **THEN** the server rejects the execution with an explicit error and makes zero modifications to YesWiki
