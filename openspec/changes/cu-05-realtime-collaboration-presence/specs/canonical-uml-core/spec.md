## MODIFIED Requirements

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

## ADDED Requirements

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
