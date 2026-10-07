## Purpose

Lets a chat user dictate a message by voice instead of typing, transcribed via Mistral's Voxtral model, so the composer stays usable when both hands are occupied at a machine.

## ADDED Requirements

### Requirement: Voice recording control in the composer
The chat composer SHALL provide a microphone control that starts and stops recording the user's microphone audio in the browser.

#### Scenario: Start and stop a recording
- **WHEN** the user clicks the microphone control while idle
- **THEN** the system starts capturing microphone audio and visibly indicates a "recording" state

#### Scenario: Live audio-level feedback while recording
- **WHEN** the user is recording and speaking
- **THEN** the composer shows a live, animated indicator of the microphone's input level (not just a static "recording" label), so the user can see the microphone is actually picking up sound before they stop

#### Scenario: Stop an in-progress recording
- **WHEN** the user clicks the microphone control while recording
- **THEN** the system stops capturing audio and begins transcription

#### Scenario: Microphone permission denied or unavailable
- **WHEN** the user clicks the microphone control and the browser denies microphone access, or `MediaRecorder` is unsupported
- **THEN** the system shows an inline error explaining voice input is unavailable, and the existing text composer remains fully usable

### Requirement: Server-side transcription via Mistral
The system SHALL transcribe recorded audio into text by sending it to Mistral's transcription API from the server, without exposing the Mistral API key to the browser.

#### Scenario: Successful transcription
- **WHEN** the browser sends a completed audio recording to the transcription endpoint
- **THEN** the server forwards the audio to Mistral's transcription model and returns the transcribed text to the browser

#### Scenario: Transcription request fails
- **WHEN** the Mistral transcription call fails (authentication error, rate limit, timeout, or other API error)
- **THEN** the server returns an error response distinguishing the failure reason, and the browser shows an inline error without losing the user's ability to type a message manually

#### Scenario: Empty or inaudible recording
- **WHEN** the transcription result is empty or contains no usable text
- **THEN** the system shows an inline message indicating nothing was understood, and does not populate the composer with empty content

### Requirement: Transcribed text requires user review before sending
Transcribed text SHALL populate the composer's editable text input and SHALL NOT be sent as a message automatically.

#### Scenario: Transcription fills the composer
- **WHEN** transcription completes successfully
- **THEN** the resulting text appears in the composer's text input, editable by the user, and no message is sent until the user explicitly submits it

#### Scenario: User edits transcribed text before sending
- **WHEN** the user modifies the transcribed text in the composer before submitting
- **THEN** the system sends the edited text as the message content, not the original transcription

### Requirement: No audio persistence
The system SHALL NOT persist recorded audio beyond the duration of a single transcription request.

#### Scenario: Audio discarded after transcription
- **WHEN** a transcription request completes (successfully or with an error)
- **THEN** the system retains no copy of the submitted audio on the server or in any datastore
