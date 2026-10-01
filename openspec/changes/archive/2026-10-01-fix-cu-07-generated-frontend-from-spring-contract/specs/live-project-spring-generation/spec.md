## MODIFIED Requirements

### Requirement: Authorized persisted-project Spring generation

The system SHALL generate a Spring project only from the authoritative persisted `ProjectDocument.model` of an authenticated, authorized project. It SHALL validate the model, derive controlled generation metadata, reuse `mapCanonicalUmlModel()` and `generateSpringProject()`, and never use browser-submitted UML or a known fixture in production. The system SHALL also generate a contract-derived web frontend from that same persisted model without requiring a pre-running user-managed Spring server and without changing the existing Spring generation endpoint.

#### Scenario: Authorized user generates from saved UML
- **WHEN** an authorized user requests Spring generation for a saved project
- **THEN** the generated artifact reflects that persisted canonical model and not its layout or a fixture

#### Scenario: Authorized user generates a frontend from saved UML
- **WHEN** an authorized user requests frontend generation for a saved project
- **THEN** the CASE derives the generated backend's validated API contract and Domain Manifest from that persisted canonical model and returns a frontend artifact that represents only the declared entities and CRUD capabilities

#### Scenario: Unauthorized or invalid generation
- **WHEN** the caller lacks project access or mapping, contract, manifest, or generation validation fails
- **THEN** no artifact is returned and the caller receives a safe bounded failure

### Requirement: Safe downloadable generated artifact

The system SHALL materialize generated files only under a server-controlled temporary root, create a safe ZIP containing the complete generated Spring project or contract-derived web frontend, stream it as a download, and remove temporary artifacts on success and failure. It SHALL not expose CASE secrets or internal filesystem paths.

#### Scenario: Generation download succeeds
- **WHEN** mapping and generation succeed
- **THEN** the user receives a ZIP containing the generated Gradle project, source, tests, configuration, entities, repositories, and controllers

#### Scenario: Frontend download succeeds
- **WHEN** frontend contract derivation and generation succeed
- **THEN** the user receives a ZIP containing the independent Next.js application, its generated contract files, local API configuration example, and run instructions

### Requirement: Persistence-aware editor action

The editor SHALL expose `Generar backend Spring` and `Generar frontend` as separate actions for an active saved project, disable each action while unsaved changes exist or its corresponding generation is active, and show bounded progress/error/download states. Each action SHALL send only the active project identifier and release browser download resources.

#### Scenario: User has unsaved local changes
- **WHEN** the editor has changes not persisted authoritatively
- **THEN** generation is unavailable until the existing Save flow succeeds

#### Scenario: User downloads a frontend
- **WHEN** the user starts frontend generation from a saved project
- **THEN** the editor requests the frontend artifact, prevents duplicate frontend requests while it is active, and surfaces a bounded backend diagnostic on failure

### Requirement: End-to-end evidence

The system SHALL test persisted-project-to-ZIP integration, authorization, failure cleanup, differing UML output, frontend download behavior, and one generated-project wrapper test/build. A real browser-to-ZIP-to-Spring CRUD manual gate SHALL remain explicit.

#### Scenario: Manual smoke
- **WHEN** a reviewer creates and saves Cliente/Pedido UML, downloads its backend, and runs the generated project
- **THEN** the generated Gradle test/build and at least one CRUD flow are recorded before acceptance

#### Scenario: Frontend manual smoke
- **WHEN** a reviewer downloads the frontend for a saved project, starts the generated Spring backend and starts the generated frontend with its configured local API base URL
- **THEN** the frontend lists, creates, edits, deletes, and reloads persisted records through the generated Spring API
