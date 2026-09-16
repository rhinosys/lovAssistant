## Purpose

Defines the local containerized orchestration topology using Docker Compose for the application and PostgreSQL services while interfacing with host-level Ollama inference.

## ADDED Requirements

### Requirement: Docker Compose orchestration topology
The system SHALL provide a `docker-compose.yml` definition orchestrating the application container and a PostgreSQL database container with persistent volume storage.

#### Scenario: Running local deployment stack
- **WHEN** an administrator runs `docker compose up -d`
- **THEN** the PostgreSQL container starts, volume mounts persist data under `postgres_data`, and the application container boots after PostgreSQL is healthy

#### Scenario: Database data persistence across container deletion
- **WHEN** containers are stopped and recreated via `docker compose down && docker compose up -d`
- **THEN** previously persisted PostgreSQL data remains intact in the named volume

### Requirement: Local host Ollama connectivity
The Docker Compose network configuration SHALL allow the containerized application to communicate securely with an Ollama instance installed directly on the host machine without public port exposure.

#### Scenario: Application connects to host Ollama
- **WHEN** the backend application container makes an inference request to `http://host.docker.internal:11434` or configured host gateway
- **THEN** the request reaches the host Ollama process over private bridge networking and receives the inference stream

### Requirement: Documented startup runbook
The repository SHALL include clear documentation and runbook instructions detailing prerequisites, environment configuration, database migration execution, and launch commands.

#### Scenario: Operator follows runbook
- **WHEN** an operator follows the setup documentation step-by-step
- **THEN** the system can be brought from zero to a fully operational local chat state in under 10 minutes
