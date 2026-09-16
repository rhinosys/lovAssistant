## Purpose

Defines server-side environment configuration loading, validation, and fail-fast startup behavior to ensure reproducible and secure deployments across environments.

## ADDED Requirements

### Requirement: Server-side environment configuration validation
The system SHALL validate all operational configuration variables at startup using a strict schema parser before initializing database connections or accepting traffic.

#### Scenario: Application starts with valid configuration
- **WHEN** all required environment variables (`DATABASE_URL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `SESSION_SECRET`, `LOG_LEVEL`) are present and valid
- **THEN** the application initializes core services and logs successful configuration load without printing secret values

#### Scenario: Application startup with missing required variables
- **WHEN** any required environment variable (such as `DATABASE_URL` or `SESSION_SECRET`) is missing or empty
- **THEN** the application logs a detailed configuration error indicating which variables are missing and exits immediately with a non-zero exit code

### Requirement: Safe configuration templates
The repository SHALL provide an `.env.example` template containing only safe placeholder values and descriptive documentation for every configurable parameter.

#### Scenario: New developer or operator inspects template
- **WHEN** an operator inspects `.env.example`
- **THEN** the template contains all required keys with dummy placeholder values and commentary explaining valid choices, without exposing any live secrets
