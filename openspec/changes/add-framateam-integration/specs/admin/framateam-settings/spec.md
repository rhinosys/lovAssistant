## Purpose

Lets an admin configure the Framateam connection and choose, channel by channel, what the assistant indexes and where its bot answers, without editing server files.

## ADDED Requirements

### Requirement: Framateam account configuration
The admin area SHALL let an admin set the Framateam instance URL, team name, login identifier and password, the bot trigger keyword and the sync interval.

#### Scenario: Save the account
- **WHEN** an admin submits a URL, team, login and password
- **THEN** the settings are persisted and the bot service and sync job use them without a restart of the web application

#### Scenario: Keep the existing password
- **WHEN** an admin saves the settings with the password field left empty
- **THEN** the previously stored password is kept unchanged

### Requirement: Password confidentiality
The system SHALL store the Framateam password encrypted with a key provided by the environment, and SHALL never include it, encrypted or not, in any API response, log line or page.

#### Scenario: Reading settings
- **WHEN** an admin loads the settings
- **THEN** the response indicates only whether a password is configured, never its value

#### Scenario: Missing encryption key
- **WHEN** an admin tries to save a password and no valid encryption key is configured
- **THEN** the save is refused with an explicit configuration error and nothing is stored in clear text

### Requirement: Environment fallback
The system SHALL use the `FRAMATEAM_*` environment variables when no setting is stored in the database, and SHALL show in the admin area which source is active.

#### Scenario: Only environment variables are set
- **WHEN** no Framateam settings are stored and `FRAMATEAM_LOGIN_ID`, `FRAMATEAM_PASSWORD`, `FRAMATEAM_TEAM` are set
- **THEN** sync and bot use the environment values and the admin area displays "configuration : .env"

### Requirement: Connection test
The admin area SHALL offer a connection test that logs in and resolves the team, reporting the connected username and team display name, or a clear error.

#### Scenario: Valid credentials
- **WHEN** an admin runs the connection test with valid credentials
- **THEN** the connected username and the team display name are shown

#### Scenario: Invalid credentials or MFA
- **WHEN** the login is refused
- **THEN** an explicit error is shown (invalid credentials, or account requiring multi-factor authentication) without exposing the password

### Requirement: Channel selection
The admin area SHALL list the team's public channels and let an admin enable, per channel, indexing and bot listening. Channels SHALL be disabled by default.

#### Scenario: Listing channels
- **WHEN** an admin opens the channel list
- **THEN** every public channel of the team is shown with its display name, its indexing and listening flags, its last sync time and its number of indexed threads

#### Scenario: New channel appears
- **WHEN** a public channel is created in Framateam after the last listing
- **THEN** it appears in the list with indexing and listening disabled

#### Scenario: Disabling indexing
- **WHEN** an admin disables indexing for a channel that has indexed threads
- **THEN** the channel is no longer synced and its threads are removed from the index

### Requirement: Manual sync trigger and status
The admin area SHALL let an admin start a sync of the enabled channels and SHALL display its progress and outcome. Only one sync SHALL run at a time.

#### Scenario: Sync already running
- **WHEN** an admin starts a sync while another sync (scheduled, CLI or manual) is running
- **THEN** the request is refused with a "sync en cours" message and no second sync starts
