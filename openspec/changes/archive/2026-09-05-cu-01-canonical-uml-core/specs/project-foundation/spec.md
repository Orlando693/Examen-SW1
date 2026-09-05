## MODIFIED Requirements

### Requirement: Root monorepo workspace
The repository SHALL provide a root npm workspace monorepo with `frontend/`, `backend/`, and shared packages under `packages/*` as workspaces.

#### Scenario: Install from repository root
- **WHEN** dependencies are installed from the repository root
- **THEN** npm resolves the frontend, backend, and shared package workspaces without requiring separate unrelated package installations

#### Scenario: Use required root folders
- **WHEN** the application structure is inspected
- **THEN** the main frontend exists under `frontend/`, the main backend exists under `backend/`, and shared reusable packages can exist under `packages/`

#### Scenario: Avoid alternate app folders
- **WHEN** the application structure is inspected
- **THEN** the main applications are not placed under `apps/web` or `apps/api`

### Requirement: Root quality and lifecycle commands
The repository SHALL expose coherent root commands for development, build, lint, typecheck, and automated tests across the frontend, backend, and shared package workspaces that participate in each command.

#### Scenario: Run global build
- **WHEN** the global build command is executed from the repository root
- **THEN** all buildable application and shared package workspaces are built successfully

#### Scenario: Run global checks
- **WHEN** the global lint, typecheck, and test commands are executed from the repository root
- **THEN** the relevant checks run for the frontend, backend, and shared package workspaces and complete successfully
