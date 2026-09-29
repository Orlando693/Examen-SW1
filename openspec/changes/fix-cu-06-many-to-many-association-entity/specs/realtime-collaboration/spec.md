## ADDED Requirements

### Requirement: Authoritative recursive and materialization commands
The collaboration boundary SHALL normalize, deduplicate, execute, persist, and broadcast recursive relationship commands and normal/self many-to-many materialization through one authoritative UML command result. It SHALL include endpoint roles and authority-selected IDs/names in the normalized intent and SHALL not permit retries or rendering to create duplicate entities.

#### Scenario: Converge on a recursive association
- **WHEN** an authorized user creates a valid self association
- **THEN** each participant installs the same relationship, roles, revision, layout, and digest through authoritative ingestion

#### Scenario: Deduplicate recursive many-to-many materialization
- **WHEN** an applied valid `Persona` self many-to-many materialization is retried with the same realtime command identity and intent
- **THEN** the server returns the original result without another write, broadcast, association entity, or relationship pair

#### Scenario: Join a migrated historical project
- **WHEN** a realtime join targets a historical project requiring supported many-to-many migration
- **THEN** the server durably migrates it before creating the session snapshot and participants receive only the version-2 document
