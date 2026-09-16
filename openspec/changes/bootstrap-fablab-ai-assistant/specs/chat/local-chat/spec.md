## Purpose

Provides an interactive conversational web interface based on assistant-ui that handles message composition, streamed generation in French, thread switching, and graceful error presentation.

## ADDED Requirements

### Requirement: Conversational message exchange in French with streaming
The system SHALL accept user messages in French through the assistant-ui interface and display model responses as real-time streamed text tokens.

#### Scenario: User submits a prompt and receives streamed output
- **WHEN** an authenticated user inputs a message in French and clicks send
- **THEN** the system creates a user message in the current thread and streams the generated response tokens progressively into the assistant message bubble until completion

#### Scenario: User sends empty or whitespace message
- **WHEN** a user attempts to submit an empty input or whitespace-only message
- **THEN** the interface disables submission and prevents sending an empty message payload to the backend

### Requirement: Interactive thread creation and switching
The system SHALL allow users to create new conversation threads and switch between previous conversations from a navigation sidebar.

#### Scenario: User creates a new conversation
- **WHEN** the user triggers the "New Conversation" action in the sidebar
- **THEN** the system initializes a fresh conversation view without previous messages and generates a new persistent thread upon first message submission

#### Scenario: User opens an existing conversation
- **WHEN** the user selects an existing conversation thread from the list
- **THEN** the system loads the complete historical message sequence for that thread and displays it in chronological order

### Requirement: Graceful error and loading state presentation
The system SHALL display clear visual indicators during response generation and explicit error banners when model generation or network transport fails.

#### Scenario: Model generation in progress
- **WHEN** the backend is processing a prompt and generating tokens
- **THEN** the interface displays an active streaming/loading indicator and disables redundant prompt submission

#### Scenario: Generation failure or disconnection
- **WHEN** the connection to the backend drops or the backend returns a generation error
- **THEN** the interface stops the streaming indicator and presents a clear error banner describing the failure without crashing the application

### Requirement: Message retry and regeneration
The system SHALL enable users to retry a failed generation or regenerate the last assistant response in a thread.

#### Scenario: User retries after a temporary failure
- **WHEN** a user clicks the "Retry" button on a failed or interrupted response
- **THEN** the system re-submits the prompt context to the backend and streams a new response replacing the failed state

### Requirement: UI extensibility for citations and approval slots
The interface SHALL maintain extensible message slot architecture capable of hosting structured citation cards and MCP tool approval controls in future phases without embedding authorization logic in client components.

#### Scenario: Rendering standard messages with extensible metadata container
- **WHEN** an assistant message is rendered
- **THEN** the message bubble renders Markdown formatted text while maintaining structured slot containers for future citation badges and action confirmation dialogs
