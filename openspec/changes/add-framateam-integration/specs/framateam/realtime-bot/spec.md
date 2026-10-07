## Purpose

Lets LOV members ask the assistant directly in Framateam and get a sourced answer in the same thread, without leaving the team chat.

## ADDED Requirements

### Requirement: Trigger conditions
The bot SHALL answer a new post only when it is in a public channel enabled for listening, is not a reply posted by the bot itself (bot replies carry a marker property), and either starts with the configured trigger keyword or mentions the assistant's account when that account is dedicated to the assistant.

#### Scenario: Keyword in an enabled channel
- **WHEN** a member posts "!lov quelle vitesse pour couper du CP 3 mm ?" in a listening-enabled public channel
- **THEN** the bot processes the question

#### Scenario: Channel not enabled or not public
- **WHEN** the same post is made in a channel not enabled for listening, a private channel or a direct message
- **THEN** the bot does nothing

#### Scenario: Bot's own reply
- **WHEN** the post is a reply previously posted by the bot
- **THEN** the bot ignores it

#### Scenario: Personal account
- **WHEN** the bot runs under a member's personal account and that member posts a triggered question
- **THEN** the bot answers it

### Requirement: Processing feedback and in-thread answer
The bot SHALL add a 👀 reaction to the triggering post while processing, SHALL post its answer as a reply in the post's thread, and SHALL remove the reaction once done.

#### Scenario: Successful answer
- **WHEN** a triggered question is processed successfully
- **THEN** a reply with the grounded answer and its source links is posted in the thread and the 👀 reaction is removed

#### Scenario: Generation failure
- **WHEN** answer generation fails
- **THEN** a short French error message is posted in the thread and the 👀 reaction is removed

### Requirement: Grounded answers with thread context
The bot SHALL produce answers with the same grounded pipeline, safety rules and source citations as the web chat, using the triggering question and the previous member questions of the thread as context.

#### Scenario: Follow-up in a thread
- **WHEN** a member asks a triggered follow-up question inside a thread
- **THEN** the earlier member questions of that thread are taken into account and assistant replies are not used as evidence

### Requirement: Robust connection
The bot SHALL reconnect the websocket with exponential backoff and jitter after any disconnection, SHALL re-authenticate when the session is no longer valid, and SHALL reload its configuration when admin settings change.

#### Scenario: Network loss
- **WHEN** the websocket connection drops
- **THEN** the bot reconnects with increasing delays capped at a few minutes and resumes listening

#### Scenario: Credentials changed in admin
- **WHEN** an admin saves new Framateam credentials
- **THEN** the bot logs in with the new credentials and reconnects without manual restart

#### Scenario: Not configured
- **WHEN** no Framateam account is configured
- **THEN** the bot stays idle, logs that it is not configured, and starts once settings are saved
