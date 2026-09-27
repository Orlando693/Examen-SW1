## MODIFIED Requirements

### Requirement: Approved relational representations
The system SHALL map UML `number` attributes to relational `NUMERIC` values, while synthetic and explicit compatible identifiers map to `BIGINT`. Enumeration references SHALL map to `VARCHAR(255)` with a deterministic `CHECK` constraint. Generalization SHALL use joined tables where a child primary key is also a foreign key to its single parent. A materialized many-to-many association class SHALL map as an ordinary entity table with its own surrogate `BIGINT` primary key and its two replacement associations SHALL map to non-null foreign keys to the original endpoint entity tables. Aggregation SHALL have no delete cascade; supported unambiguous one-to-one and one-to-many composition SHALL use a non-null part foreign key and delete cascade.

#### Scenario: Joined child reuses the parent key
- **WHEN** a valid class has one generalization parent
- **THEN** its relational table uses a primary key that is also a foreign key to the parent table without an independent synthetic key

#### Scenario: Map a materialized association class
- **WHEN** canonical UML contains `Alumno`, `Materia`, and a materialized `AlumnoMateria` class
- **THEN** the relational model contains exactly three entity tables, with `alumno_materia` having its own primary key and foreign keys to `alumno` and `materia`, and contains no hidden many-to-many join table

#### Scenario: Reject unmigrated direct many-to-many input
- **WHEN** a legacy direct many-to-many association reaches relational mapping without successful document migration
- **THEN** mapping returns a migration-required diagnostic and does not expose the retired join-table representation
