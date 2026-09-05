## Purpose

Defines the reusable canonical UML domain core that future editor, persistence, collaboration, generation, import, and assistant features will share without depending on UI or backend frameworks.

## ADDED Requirements

### Requirement: Framework agnostic UML core package
The system SHALL provide a reusable UML core package under `packages/uml-core/` that is part of the root npm workspace and does not depend on frontend, backend, UI, canvas, database, authentication, or realtime frameworks.

#### Scenario: Package exists in the shared packages area
- **WHEN** the repository structure is inspected
- **THEN** the UML core package exists under `packages/uml-core/`

#### Scenario: Package avoids framework dependencies
- **WHEN** the UML core package dependencies are inspected
- **THEN** it does not depend on Next.js, React, Material UI, React Flow, NestJS, Fastify, Prisma, PostgreSQL, Socket.IO, or other out-of-scope framework/runtime packages

#### Scenario: Package participates in root checks
- **WHEN** global root test, typecheck, lint, and build commands are executed
- **THEN** the UML core package is included in those checks

### Requirement: Canonical project document structure
The system SHALL represent each UML project as a serializable `ProjectDocument` containing metadata, revision information, timestamps, a semantic UML model, and a separate visual diagram layout.

#### Scenario: Create project document
- **WHEN** a new project document is created in memory
- **THEN** it has a stable UUID, metadata, revision, timestamps, a UML model, and a diagram layout

#### Scenario: Separate semantic model and layout
- **WHEN** a project document is inspected
- **THEN** semantic UML data is stored in the UML model and visual or positional data is stored in the diagram layout

#### Scenario: Ownership is conceptual only
- **WHEN** the project document type is inspected
- **THEN** it can represent an owner reference when one is available but does not implement authentication, authorization, persistence, or ownership enforcement

### Requirement: Initial UML semantic model
The canonical UML model SHALL support the initial UML subset required by the product while keeping pure UML semantics separate from generation metadata.

#### Scenario: Classes and members are represented
- **WHEN** a class is represented in the model
- **THEN** it can contain attributes/properties, operations, visibility, types, and generation metadata without mixing layout coordinates into semantic data

#### Scenario: Enumerations are represented
- **WHEN** an enumeration is represented in the model
- **THEN** it can contain stable literals and generation metadata without requiring UI-specific information

#### Scenario: Relationships are represented
- **WHEN** associations, aggregation, composition, and generalization are represented in the model
- **THEN** they reference stable element identifiers and represent multiplicity where applicable

#### Scenario: Packages can group elements
- **WHEN** packages are needed to organize the UML model
- **THEN** model elements can reference package ownership or containment without relying on folder paths or UI tree state

### Requirement: Stable identifiers and serializable data
The UML core SHALL use stable UUID-based identifiers and plain serializable data structures so project documents can be serialized, deserialized, and round-tripped without losing semantic or layout information.

#### Scenario: Serialize and deserialize a document
- **WHEN** a project document containing classes, attributes, relationships, and layout data is serialized and deserialized
- **THEN** the resulting document preserves stable identifiers, semantic UML data, revision data, metadata, and diagram layout data

#### Scenario: Round trip remains framework independent
- **WHEN** a round-trip serialization test is executed
- **THEN** the result does not require React Flow, a canvas, a database, or a backend service

### Requirement: Single reusable validation engine
The UML core SHALL provide a single reusable validation engine that evaluates project documents and returns structured diagnostics with severity, code, message, logical path, and element reference when applicable.

#### Scenario: Validate a valid model
- **WHEN** a valid project document is validated
- **THEN** the validation result contains no blocking errors

#### Scenario: Report error diagnostics
- **WHEN** a project document violates an essential invariant
- **THEN** the validation result contains an `ERROR` diagnostic with code, message, logical path, and element reference when applicable

#### Scenario: Report warning diagnostics
- **WHEN** a project document has a non-blocking modeling concern
- **THEN** the validation result can contain a `WARNING` diagnostic that does not block operations by default

#### Scenario: Validation API is reusable
- **WHEN** future consumers need validation for editing, persistence, collaboration, import, generation, or assistants
- **THEN** they can call the same UML core validation API without depending on UI or backend framework code

### Requirement: Initial validation rules
The validation engine SHALL include initial rules for essential canonical model invariants without attempting to implement the full UML specification.

#### Scenario: Detect duplicate identifiers
- **WHEN** a project document contains duplicate element identifiers where uniqueness is required
- **THEN** validation reports an `ERROR`

#### Scenario: Detect missing references
- **WHEN** a relationship or layout entry references an element that does not exist
- **THEN** validation reports an `ERROR`

#### Scenario: Detect invalid multiplicities
- **WHEN** a relationship multiplicity is malformed or internally inconsistent
- **THEN** validation reports an `ERROR`

#### Scenario: Detect malformed relationships
- **WHEN** a relationship lacks required endpoints or uses endpoints incompatible with its kind
- **THEN** validation reports an `ERROR`

#### Scenario: Detect invalid names or structures
- **WHEN** required names or structural fields are empty or invalid according to the core model rules
- **THEN** validation reports a structured diagnostic

### Requirement: Typed UML command route
The UML core SHALL define typed UML commands and apply model mutations through a command bus and deterministic command executors instead of direct external mutation.

#### Scenario: Execute typed command
- **WHEN** a supported UML command is sent to the command bus
- **THEN** the matching executor applies the mutation deterministically and returns a structured result

#### Scenario: Reject unsupported command
- **WHEN** an unsupported or invalid command is sent to the command bus
- **THEN** the command bus returns a structured failure without mutating the project document

#### Scenario: Validate command result
- **WHEN** a command would produce a model with blocking validation errors
- **THEN** the command result reports the validation failure and does not accept the invalid mutation

### Requirement: Initial UML command families
The UML core SHALL support initial command families for creating, deleting, renaming, and editing classes and attributes, creating associations, updating multiplicity, and moving diagram nodes.

#### Scenario: Create class through command bus
- **WHEN** a `CreateClass` command is executed
- **THEN** a class is added to the semantic UML model through the command route

#### Scenario: Rename class through command bus
- **WHEN** a `RenameClass` command is executed
- **THEN** the target class name changes through the command route

#### Scenario: Manage attributes through command bus
- **WHEN** `AddAttribute`, `RemoveAttribute`, or `UpdateAttribute` commands are executed
- **THEN** class attributes change through the command route

#### Scenario: Create association through command bus
- **WHEN** a `CreateAssociation` command is executed
- **THEN** a relationship is added to the semantic UML model through the command route

#### Scenario: Update multiplicity through command bus
- **WHEN** an `UpdateMultiplicity` command is executed
- **THEN** relationship multiplicity changes through the command route

#### Scenario: Move node changes layout only
- **WHEN** a `MoveNode` command is executed
- **THEN** only diagram layout data changes and semantic UML data remains unchanged

### Requirement: Local undo and redo history
The UML core SHALL provide local undo and redo behavior with a configurable history limit and a default limit of 100 operations.

#### Scenario: Undo accepted command
- **WHEN** a command has been accepted and undo is requested
- **THEN** the project document returns to the previous state deterministically

#### Scenario: Redo undone command
- **WHEN** a command has been undone and redo is requested
- **THEN** the project document returns to the post-command state deterministically

#### Scenario: Clear redo after new command
- **WHEN** a new command is accepted after an undo
- **THEN** the redo stack is cleared

#### Scenario: Enforce history limit
- **WHEN** more accepted operations than the configured history limit are executed
- **THEN** only the most recent operations up to that limit remain undoable

#### Scenario: Collaboration undo is not implemented
- **WHEN** undo/redo behavior is inspected
- **THEN** it is local only and does not implement distributed or realtime collaboration undo semantics

### Requirement: Domain tests independent of visual editor
The UML core SHALL include automated tests proving the model, validation, command bus, and undo/redo behavior without depending on React Flow or the frontend visual workspace.

#### Scenario: Run UML core tests
- **WHEN** UML core tests are executed
- **THEN** they validate project creation, classes, attributes, enums, representative relationships, model/layout separation, serialization round-trip, invalid model diagnostics, command execution, move layout behavior, undo, redo, redo clearing, and history limit behavior

#### Scenario: Global checks include UML core
- **WHEN** root global test, typecheck, lint, and build commands are executed
- **THEN** the UML core checks run successfully along with the existing frontend and backend checks

### Requirement: CU-01 implementation documentation
The implementation SHALL document the actual CU-01 outcome in `docs/puds/use-cases/CU-01-canonical-uml-core.md` and update status-oriented documentation when implementation state changes.

#### Scenario: CU-01 document records implementation
- **WHEN** CU-01 implementation is completed
- **THEN** the CU document records objective, scope, architecture, package structure, domain model, ID/type/relationship decisions, validation rules, command design, undo/redo strategy, tests, errors, corrections, limitations, debt, and final result

#### Scenario: Status documents reflect CU-01 work
- **WHEN** CU-01 implementation progresses or completes
- **THEN** `docs/STATUS.md` and `docs/HANDOFF.md` reflect the current CU state, active OpenSpec, verification status, and next action
