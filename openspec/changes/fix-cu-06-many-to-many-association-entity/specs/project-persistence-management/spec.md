## ADDED Requirements

### Requirement: Durable role-aware recursive and association-entity documents
The persistence boundary SHALL persist and return recursive endpoint roles, self associations, and normal or recursive association entities as ordinary canonical model and layout data. It SHALL not store a redundant direct many-to-many relation or UI-derived entity.

#### Scenario: Round-trip recursive one-to-many
- **WHEN** an authoritative project containing `Empleado` jefe/subordinados is stored and retrieved
- **THEN** its one recursive relationship, roles, multiplicities, IDs, and layout are recovered without duplication or dangling references

#### Scenario: Round-trip recursive many-to-many entity
- **WHEN** an authoritative project containing `PersonaAmistad` is stored and retrieved
- **THEN** its stable entity ID, identifier attribute, two distinct roles, two relationships to `Persona`, and layout entries are recovered once

### Requirement: One-time authoritative legacy many-to-many migration
The persistence boundary SHALL migrate supported version-1 direct many-to-many documents to version 2 before normal editing, realtime join, relational mapping, or generation. It SHALL atomically persist the migrated resource and SHALL not migrate in a browser renderer or repeat a completed migration.

#### Scenario: Migrate normal legacy many-to-many
- **WHEN** an authorized operation reaches a version-1 `Alumno * <-> * Materia` document
- **THEN** the persisted version-2 document contains one deterministic association entity and no direct many-to-many relation

#### Scenario: Reject nonrepresentable recursive legacy document
- **WHEN** a version-1 self many-to-many lacks a relationship name or distinct valid roles
- **THEN** the operation returns `LEGACY_MANY_TO_MANY_MIGRATION_FAILED`, leaves version 1 unchanged, and does not use a legacy mapping or generator path
