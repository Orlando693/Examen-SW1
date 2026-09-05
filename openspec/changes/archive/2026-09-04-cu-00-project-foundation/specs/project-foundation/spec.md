## Purpose

Defines the executable project foundation for the main CASE application so the repository can be installed, developed, tested, built, and shown communicating from frontend to backend.

## ADDED Requirements

### Requirement: Root monorepo workspace
The repository SHALL provide a root npm workspace monorepo with `frontend/` and `backend/` as the application workspaces.

#### Scenario: Install from repository root
- **WHEN** dependencies are installed from the repository root
- **THEN** npm resolves the frontend and backend workspaces without requiring separate unrelated package installations

#### Scenario: Use required root folders
- **WHEN** the application structure is inspected
- **THEN** the main frontend exists under `frontend/` and the main backend exists under `backend/`

#### Scenario: Avoid alternate app folders
- **WHEN** the application structure is inspected
- **THEN** the main applications are not placed under `apps/web` or `apps/api`

### Requirement: Root quality and lifecycle commands
The repository SHALL expose coherent root commands for development, build, lint, typecheck, and automated tests across the frontend and backend workspaces.

#### Scenario: Run global build
- **WHEN** the global build command is executed from the repository root
- **THEN** both application workspaces are built successfully

#### Scenario: Run global checks
- **WHEN** the global lint, typecheck, and test commands are executed from the repository root
- **THEN** the relevant checks run for both application workspaces and complete successfully

### Requirement: Backend health endpoint
The backend SHALL expose `GET /health` and return HTTP 200 with a minimal structured response indicating that the API is healthy.

#### Scenario: Health check succeeds
- **WHEN** a client requests `GET /health` from the running backend
- **THEN** the response status is HTTP 200 and the body clearly indicates a healthy API

### Requirement: Frontend health status display
The frontend SHALL request the configured backend health endpoint and display whether the API is available or unavailable.

#### Scenario: API available status
- **WHEN** the frontend health request succeeds
- **THEN** the page clearly displays that the API is available

#### Scenario: API unavailable status
- **WHEN** the frontend health request fails
- **THEN** the page clearly displays that the API is unavailable

### Requirement: Environment based backend URL
The frontend SHALL read the backend base URL from configuration documented in `.env.example` instead of hardcoding an environment-specific backend URL into application behavior.

#### Scenario: Configure backend URL
- **WHEN** a developer sets the documented frontend backend URL environment variable
- **THEN** the frontend uses that value to build the health request URL

### Requirement: Local development CORS
The backend SHALL allow the local development frontend origin to call the backend health endpoint while keeping CORS configuration explicit and environment driven where practical.

#### Scenario: Frontend calls backend in local development
- **WHEN** the frontend and backend run locally on their configured development ports
- **THEN** the browser can complete the health request without a CORS failure

### Requirement: Baseline automated tests
The project SHALL include baseline automated tests for the backend health endpoint and the frontend health status display.

#### Scenario: Backend health test
- **WHEN** backend tests are executed
- **THEN** a test verifies the `GET /health` success response

#### Scenario: Frontend health display test
- **WHEN** frontend tests are executed
- **THEN** tests verify the available and unavailable health states displayed by the UI

### Requirement: CU-00 implementation documentation
The implementation SHALL document the actual CU-00 outcome in `docs/puds/use-cases/CU-00-project-foundation.md` and update status-oriented documentation when the implementation state changes.

#### Scenario: CU document records implementation
- **WHEN** CU-00 implementation is completed
- **THEN** the CU document records objective, scope, decisions, structure, commands, implementation, automated tests, manual tests, errors, corrections, limitations, and final result

#### Scenario: Status documents reflect active work
- **WHEN** CU-00 implementation progresses or completes
- **THEN** `docs/STATUS.md` and `docs/HANDOFF.md` reflect the current CU state, active OpenSpec, pending work, test status, and next action
