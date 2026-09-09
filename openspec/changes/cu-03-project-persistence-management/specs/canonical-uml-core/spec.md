## MODIFIED Requirements

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

## ADDED Requirements

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
