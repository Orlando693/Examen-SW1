## MODIFIED Requirements

### Requirement: Approved relational representations
The system SHALL map UML `number` attributes to relational `NUMERIC` values, while synthetic and explicit compatible identifiers map to `BIGINT`. Enumeration references SHALL map to `VARCHAR(255)` with a deterministic `CHECK` constraint. Generalization SHALL use joined tables where a child primary key is also a foreign key to its single parent. A recursive one-to-many association SHALL map to one entity table with a role-derived self-referential foreign key. A materialized normal or recursive many-to-many association entity SHALL map as an ordinary entity table with its own surrogate `BIGINT` primary key and role-distinct non-null foreign keys. Direct many-to-many input SHALL not map to a hidden join-table representation. Aggregation SHALL have no delete cascade; supported unambiguous one-to-one and one-to-many composition SHALL use a non-null part foreign key and delete cascade.

#### Scenario: Joined child reuses the parent key
- **WHEN** a valid class has one generalization parent
- **THEN** its relational table uses a primary key that is also a foreign key to the parent table without an independent synthetic key

#### Scenario: Map recursive one-to-many
- **WHEN** canonical UML contains `Empleado 0..* subordinados` and `Empleado 0..1 jefe`
- **THEN** the relational model contains one `empleado` table with `jefe_id` as a self-referential foreign key and no join table

#### Scenario: Map normal association entity
- **WHEN** canonical UML contains `Alumno`, `Materia`, and materialized `AlumnoMateria`
- **THEN** the relational model contains exactly three entity tables, with `alumno_materia` having its own primary key and foreign keys to `alumno` and `materia`

#### Scenario: Map recursive association entity
- **WHEN** canonical UML contains `Persona` and materialized `PersonaAmistad` with roles `personaOrigen` and `personaDestino`
- **THEN** the relational model contains `persona_amistad` with its own primary key plus `persona_origen_id` and `persona_destino_id` foreign keys to `persona`

#### Scenario: Reject unmigrated direct many-to-many input
- **WHEN** a legacy direct many-to-many association reaches relational mapping without successful document migration
- **THEN** mapping returns a migration-required diagnostic and exposes no retired join-table representation
