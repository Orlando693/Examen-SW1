## ADDED Requirements

### Requirement: Durable materialized association documents
The persistence boundary SHALL persist and return a materialized association class and its replacement relationships as ordinary canonical model and layout data, without storing a redundant direct many-to-many relation or UI-derived association entity.

#### Scenario: Round-trip materialized association
- **WHEN** an authoritative project containing a materialized association is stored and retrieved
- **THEN** its stable class ID, name, surrogate identifier attribute, replacement relationship IDs, and layout entries are recovered once without dangling references

### Requirement: One-time authoritative legacy many-to-many migration
The persistence boundary SHALL use the existing `ProjectResource.documentSchemaVersion` to migrate supported version-1 direct many-to-many documents to version 2 before normal project editing, realtime join, relational mapping, or generation. It SHALL validate and atomically persist the migrated resource through the authoritative coordinator, and SHALL not migrate in a browser renderer or repeat a completed migration.

#### Scenario: Migrate before generation
- **WHEN** an authorized request opens or generates from a stored version-1 project containing direct many-to-many data
- **THEN** the authoritative resource is migrated and persisted as version 2 before the operation continues, and downstream generation receives only the association-class model

#### Scenario: Fail a nonrepresentable legacy document safely
- **WHEN** a version-1 direct many-to-many relationship cannot be migrated without losing metadata
- **THEN** the operation returns a stable actionable migration diagnostic, leaves the stored version-1 resource unchanged, and does not use the legacy relational or generator path
