# canonical-uml-core Specification

## Purpose

Defines the reusable canonical UML domain core that future editor, persistence, collaboration, generation, import, and assistant features will share without depending on UI or backend frameworks.

## Requirements

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
The UML core SHALL use stable UUID-based identifiers and plain serializable data structures so project documents can be serialized, structurally decoded from unknown data, semantically validated, and round-tripped without losing semantic or layout information.

#### Scenario: Serialize and deserialize a document
- **WHEN** a project document containing classes, attributes, relationships, and layout data is serialized and deserialized
- **THEN** the resulting document preserves stable identifiers, semantic UML data, revision data, metadata, and diagram layout data

#### Scenario: Structurally decode unknown document data
- **WHEN** unknown JSON data is received from persistence or an API boundary
- **THEN** the UML core accepts only data matching the runtime project-document structure and reports a structured decoding failure for malformed or incompatible data

#### Scenario: Round trip remains framework independent
- **WHEN** a round-trip serialization or structural decoding test is executed
- **THEN** the result does not require React Flow, a canvas, a database, or a backend service

### Requirement: Single reusable validation engine
The UML core SHALL provide a single reusable semantic validation engine that evaluates structurally decoded project documents and returns structured diagnostics with severity, code, message, logical path, and element reference when applicable.

#### Scenario: Validate a valid model
- **WHEN** a structurally decoded valid project document is validated
- **THEN** the validation result contains no blocking errors

#### Scenario: Report error diagnostics
- **WHEN** a project document violates an essential invariant
- **THEN** validation reports an `ERROR` diagnostic with code, message, logical path, and element reference when applicable

#### Scenario: Report warning diagnostics
- **WHEN** a project document has a non-blocking modeling concern
- **THEN** validation reports a `WARNING` diagnostic that does not block operations by default

#### Scenario: Validation API is reusable
- **WHEN** future consumers need validation for editing, persistence, collaboration, import, generation, or assistants
- **THEN** they can call the same UML core semantic validation API without depending on UI or backend framework code

### Requirement: Persisted document format compatibility
The UML core SHALL define framework-independent decoding for the `ProjectResource` persistence envelope, with its `ProjectDocument` and explicit `documentSchemaVersion`, while keeping `storageVersion` outside `ProjectDocument`.

#### Scenario: Decode the initial persisted format
- **WHEN** a `ProjectResource` declares supported `documentSchemaVersion` 1 and contains a structurally valid project document
- **THEN** the core decodes the resource/document for semantic validation and persistence consumers

#### Scenario: Reject an unsupported persisted format
- **WHEN** an envelope declares an unsupported document schema version
- **THEN** the core reports a format-compatibility failure without changing the semantic UML validation rules

#### Scenario: Keep storage concurrency external to canonical history
- **WHEN** a persisted project is decoded or a `UmlHistory` snapshot is inspected
- **THEN** `storageVersion` is not part of `ProjectDocument` and cannot be changed by a UML command, undo, or redo

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
The UML core SHALL provide local undo and redo behavior with a configurable history limit and a default limit of 100 operations, while consumers SHALL NOT use its snapshot restoration as collaborative undo or apply authoritative remote commands as local history entries.

#### Scenario: Undo accepted command
- **WHEN** a command has been accepted in a non-collaborative local history and undo is requested
- **THEN** the project document returns to the previous state deterministically

#### Scenario: Redo undone command
- **WHEN** a local command has been undone and redo is requested
- **THEN** the project document returns to the post-command state deterministically

#### Scenario: Clear redo after new command
- **WHEN** a new local command is accepted after an undo
- **THEN** the redo stack is cleared

#### Scenario: Enforce history limit
- **WHEN** more accepted local operations than the configured history limit are executed
- **THEN** only the most recent operations up to that limit remain undoable

#### Scenario: Collaboration undo is not implemented
- **WHEN** a realtime collaboration session is active or an authoritative remote result is applied
- **THEN** snapshot-based undo and redo are unavailable and the remote result is not inserted into local `UmlHistory`

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

### Requirement: Editor-required UML command extensions
The UML core SHALL expose minimal additional command-bus operations needed by the manual editor for UML elements already present in the canonical model but not fully covered by the initial command set.

#### Scenario: Create enumeration through command bus
- **WHEN** a supported command to create a UML enumeration is executed
- **THEN** an enumeration is added to the semantic UML model through the command route

#### Scenario: Rename enumeration through command bus
- **WHEN** a supported command to rename a UML enumeration is executed
- **THEN** the target enumeration name changes through the command route

#### Scenario: Manage enumeration literals through command bus
- **WHEN** supported commands add, update, or remove enumeration literals
- **THEN** enumeration literals change through the command route

#### Scenario: Delete enumeration through command bus
- **WHEN** a supported command deletes a UML enumeration
- **THEN** the enumeration and invalidated visual/layout references are removed through the command route

#### Scenario: Create generalization through command bus
- **WHEN** a supported command creates a UML generalization between classes
- **THEN** a generalization relationship is added to the semantic UML model through the command route

#### Scenario: Delete relationship through command bus
- **WHEN** a supported command deletes a UML relationship
- **THEN** the relationship is removed from the semantic UML model through the command route

#### Scenario: Apply batch layout through command bus
- **WHEN** a supported command applies positions for multiple diagram nodes
- **THEN** the command updates only `DiagramLayout` through the command route and preserves the semantic UML model

#### Scenario: Batch layout is one history entry
- **WHEN** a batch layout command is accepted through local history
- **THEN** one undo restores all previous node positions from that layout operation and one redo reapplies them

#### Scenario: Preserve validation and immutability contracts
- **WHEN** any editor-required command extension is accepted or rejected
- **THEN** it follows the existing command result, validation, document cloning, and non-mutating caller-owned document contracts

### Requirement: Closed realtime UML command set
The UML core SHALL expose a framework-independent runtime decoder for exactly the supported realtime command types: `CreateClass`, `DeleteClass`, `RenameClass`, `CreateEnumeration`, `RenameEnumeration`, `DeleteEnumeration`, `AddEnumerationLiteral`, `UpdateEnumerationLiteral`, `RemoveEnumerationLiteral`, `AddAttribute`, `UpdateAttribute`, `RemoveAttribute`, `CreateAssociation`, `CreateGeneralization`, `DeleteRelationship`, `UpdateMultiplicity`, `UpdateRelationship`, `MoveNode`, and `ApplyLayout`.

#### Scenario: Decode every supported command family
- **WHEN** structurally valid unknown data represents one of the allowed commands with valid bounded fields
- **THEN** the decoder returns the matching typed `UmlCommand` without requiring frontend, backend, database, or realtime framework code

#### Scenario: Reject unsupported or malformed commands
- **WHEN** unknown data contains an unsupported discriminator, missing or extra field, malformed UUID, non-finite coordinate, invalid nested value, or React Flow object
- **THEN** the decoder returns a structured failure before command execution

### Requirement: Deterministic authoritative command application
The UML command route SHALL support deterministic application of server-normalized identifiers and an authoritative operation timestamp so every client applying an accepted command to the same base document produces equivalent canonical model, layout, revision, and timestamps.

#### Scenario: Normalize generated identifiers
- **WHEN** a supported create, move, or layout command requires an identifier that was absent from the client intention
- **THEN** the authoritative accepted command contains the stable server-selected identifier used by all participants

#### Scenario: Apply an authoritative timestamp
- **WHEN** an accepted realtime command is applied on server and clients
- **THEN** all applications use the same authoritative timestamp instead of independent client clocks

#### Scenario: Apply authoritative auto-layout once
- **WHEN** an originating client submits one `ApplyLayout` containing calculated logical positions
- **THEN** the server and other clients apply that normalized command without rerunning the layout engine

### Requirement: Canonical command and document digests
The UML core SHALL provide framework-independent deterministic canonical serialization suitable for SHA-256 command-intention and `ProjectDocument` digests, without using ordinary object insertion order as a semantic contract.

#### Scenario: Equivalent intent has one digest
- **WHEN** strict decoded command-intention objects differ only by object key order
- **THEN** their canonical representation and SHA-256 digest are equal after semantic defaults are materialized

#### Scenario: Semantic change has another digest
- **WHEN** project/session/actor/base fields or one command semantic field differs
- **THEN** canonical intent digest differs before server-generated normalization

#### Scenario: Persisted document digest is reproducible
- **WHEN** equivalent canonical project documents are serialized for collaboration
- **THEN** they produce the same digest independent of frontend, backend, React Flow, or database object insertion order
