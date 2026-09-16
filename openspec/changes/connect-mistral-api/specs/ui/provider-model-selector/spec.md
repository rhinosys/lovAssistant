## Purpose

Allows users to switch between local Ollama and Mistral AI inference directly within the chat interface, displaying provider status and provider-specific error banners.

## ADDED Requirements

### Requirement: Provider and Model Selection in Chat UI
The chat UI SHALL allow users to select between local Ollama and Mistral AI cloud providers, and select available models for the active provider.

#### Scenario: Switching provider to Mistral
- **WHEN** the user selects "Mistral AI" in the provider dropdown or toggle
- **THEN** subsequent chat messages in that thread are routed through the Mistral API and a Mistral indicator badge is displayed

#### Scenario: Switching provider to Local Ollama
- **WHEN** the user selects "Ollama (Local)" in the provider control
- **THEN** subsequent chat messages are routed to the local Ollama instance

### Requirement: Provider Status and Error Feedback
The chat UI SHALL display clear status badges and contextual error banners when inference fails or credentials are misconfigured.

#### Scenario: Authentication error notification
- **WHEN** the backend returns a 401 Authentication Error for Mistral API
- **THEN** the UI displays an alert notifying the user that `MISTRAL_API_KEY` is missing or invalid in server configuration

#### Scenario: Rate limit error notification
- **WHEN** the backend returns a 429 Rate Limit Error
- **THEN** the UI displays an alert indicating that Mistral API quota or rate limits have been reached
