## ADDED Requirements

### Requirement: Role-aware recursive associations
The system SHALL permit an `ASSOCIATION` whose endpoints reference the same canonical class, SHALL persist optional endpoint `roleName` values, and SHALL preserve them through canonical commands. It SHALL reject a `GENERALIZATION` whose endpoints reference the same class.

#### Scenario: Accept a self association
- **WHEN** a modeler creates an association from `Empleado` to `Empleado`
- **THEN** the canonical model contains one valid recursive association with equal endpoint class IDs

#### Scenario: Reject self generalization
- **WHEN** a modeler creates a generalization from a class to itself
- **THEN** validation rejects the mutation and the canonical model is unchanged

#### Scenario: Preserve recursive endpoint roles
- **WHEN** a modeler assigns `jefe` and `subordinados` to a recursive association's endpoints
- **THEN** both role names are retained in the canonical document and available to downstream mapping

### Requirement: Atomic normal many-to-many association materialization
The system SHALL detect a normal many-to-many association when both endpoint multiplicity upper bounds represent many and SHALL replace it atomically with one normal canonical association entity and exactly two replacement associations. The resulting class SHALL have a stable persisted identity, an identifier-marked `id: number` attribute, and normal editability.

#### Scenario: Create a normal many-to-many association
- **WHEN** a user creates `Alumno * <-> * Materia`
- **THEN** the document contains `Alumno`, `Materia`, exactly one `AlumnoMateria` association entity, exactly two replacement relationships, and no direct many-to-many relationship

#### Scenario: Update an association into many-to-many
- **WHEN** a user updates an existing non-recursive association so both endpoint upper bounds represent many
- **THEN** the materialized result is committed as one canonical mutation

### Requirement: Atomic recursive many-to-many association materialization
The system SHALL materialize a recursive many-to-many association only when it has a non-empty relationship name and two distinct non-empty endpoint roles. It SHALL create exactly one named association entity with two role-distinguished associations to the same class and SHALL retain no direct recursive many-to-many relationship.

#### Scenario: Materialize self many-to-many once
- **WHEN** a user creates `Persona * <-> * Persona` named `Amistad` with roles `personaOrigen` and `personaDestino`
- **THEN** the document contains exactly one `PersonaAmistad` class, its identifier-marked `id: number`, two relationships to `Persona`, and no direct self many-to-many relationship

#### Scenario: Reject ambiguous self many-to-many
- **WHEN** a self many-to-many lacks a relationship name, a role, or has equal endpoint roles
- **THEN** the command is rejected without creating classes, relationships, attributes, or layout entries

### Requirement: Safe lifecycle and versioned migration
The system SHALL preserve a materialized association entity unless an explicit deletion removes it and SHALL migrate supported version-1 direct many-to-many documents to sole version-2 association-entity representation. Migration SHALL be deterministic and idempotent.

#### Scenario: Undo and redo materialization
- **WHEN** a local materialization is undone and then redone
- **THEN** undo restores the exact prior relation and redo restores the same entity, roles, identifiers, relationships, and layout without duplicates

#### Scenario: Fail closed for unmappable legacy self many-to-many
- **WHEN** a version-1 self many-to-many lacks determinable relationship semantics or distinct roles
- **THEN** migration returns `LEGACY_MANY_TO_MANY_MIGRATION_FAILED`, leaves the stored version-1 document unchanged, and creates no partial version-2 model
