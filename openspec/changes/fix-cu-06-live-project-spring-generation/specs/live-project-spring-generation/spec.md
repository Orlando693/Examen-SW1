## ADDED Requirements

### Requirement: Authorized persisted-project Spring generation

The system SHALL generate a Spring project only from the authoritative persisted `ProjectDocument.model` of an authenticated, authorized project. It SHALL validate the model, derive controlled generation metadata, reuse `mapCanonicalUmlModel()` and `generateSpringProject()`, and never use browser-submitted UML or a known fixture in production.

#### Scenario: Authorized user generates from saved UML
- **WHEN** an authorized user requests Spring generation for a saved project
- **THEN** the generated artifact reflects that persisted canonical model and not its layout or a fixture

#### Scenario: Unauthorized or invalid generation
- **WHEN** the caller lacks project access or mapping/generation validation fails
- **THEN** no artifact is returned and the caller receives a safe bounded failure

### Requirement: Safe downloadable generated artifact

The system SHALL materialize generated files only under a server-controlled temporary root, create a safe ZIP containing the complete generated Spring project, stream it as a download, and remove temporary artifacts on success and failure. It SHALL not expose CASE secrets or internal filesystem paths.

#### Scenario: Generation download succeeds
- **WHEN** mapping and generation succeed
- **THEN** the user receives a ZIP containing the generated Gradle project, source, tests, configuration, entities, repositories, and controllers

### Requirement: Persistence-aware editor action

The editor SHALL expose `Generar backend Spring` for an active saved project, disable it while unsaved changes exist or generation is active, and show bounded progress/error/download states. The action SHALL send only the active project identifier and release browser download resources.

#### Scenario: User has unsaved local changes
- **WHEN** the editor has changes not persisted authoritatively
- **THEN** generation is unavailable until the existing Save flow succeeds

### Requirement: End-to-end evidence

The system SHALL test persisted-project-to-ZIP integration, authorization, failure cleanup, differing UML output, frontend download behavior, and one generated-project wrapper test/build. A real browser-to-ZIP-to-Spring CRUD manual gate SHALL remain explicit.

#### Scenario: Manual smoke
- **WHEN** a reviewer creates and saves Cliente/Pedido UML, downloads its backend, and runs the generated project
- **THEN** the generated Gradle test/build and at least one CRUD flow are recorded before acceptance
