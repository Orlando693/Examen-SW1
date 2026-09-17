# uml-relational-mapping Specification

## Purpose
Defines a deterministic, explicit relational representation derived only from a valid canonical UML model, so downstream generators can consume database semantics without interpreting UML or layout state.

## Requirements

### Requirement: Explicit deterministic relational model
The system SHALL transform a valid `CanonicalUmlModel` plus optional relational generation metadata into an explicit `RelationalModel` containing ordered tables, columns, primary keys, foreign keys, unique constraints, indexes, relations, enum/domain representations, provenance metadata, and structured diagnostics. The transformation SHALL not consume `DiagramLayout`, React Flow data, project persistence metadata, or realtime state. Relational metadata SHALL remain outside the canonical UML model.

#### Scenario: Equivalent canonical inputs map identically
- **WHEN** semantically equivalent canonical models differ only in object-key or input-array order
- **THEN** their relational models, identifiers, names, ordering, and diagnostics are equivalent

#### Scenario: Blocking source model is rejected
- **WHEN** the canonical UML validation result contains a blocking error
- **THEN** mapping returns structured mapping failure and no partial relational model is exposed as generatable

### Requirement: Deterministic relational mapping rules
The system SHALL apply one documented deterministic rule set for classes, attributes, explicit identifiers, primitive and enumeration types, nullability, uniqueness, indexes, associations, aggregation, composition, generalization, foreign keys, and join tables. Each entity table SHALL have exactly one primary key: an explicitly declared compatible identifier or a synthetic `BIGINT` identity key. Attribute names SHALL NOT imply identifier behavior. Ambiguous or unsupported source semantics SHALL produce structured diagnostics rather than guessed relational behavior.

#### Scenario: Multiplicity creates a stable foreign-key relation
- **WHEN** two mapped classes have a supported one-to-many association
- **THEN** the relational model contains the documented foreign-key column, foreign key, nullability, ownership metadata, and stable constraint names

#### Scenario: Unsupported association is reported
- **WHEN** an association cannot be mapped under the documented rules
- **THEN** the mapper returns a stable diagnostic that identifies the source relationship and reason

#### Scenario: Invalid explicit identifier metadata is rejected
- **WHEN** identifier metadata refers to a missing, incompatible, or duplicate class attribute
- **THEN** mapping fails with a deterministic blocking diagnostic and does not substitute a synthetic key

### Requirement: Stable SQL naming and collision handling
The system SHALL derive PostgreSQL identifiers using one deterministic naming strategy with reserved-word handling, length limits, provenance-based collision disambiguation, and deterministic ordering. No generated identifier SHALL depend on iteration timing, random values, or machine-specific paths.

#### Scenario: Colliding names are resolved reproducibly
- **WHEN** distinct UML elements normalize to the same SQL identifier
- **THEN** each receives a distinct, stable, legal identifier derived from its stable source identity

### Requirement: Approved relational representations
The system SHALL map UML `number` attributes to relational `NUMERIC` values, while synthetic and explicit compatible identifiers map to `BIGINT`. Enumeration references SHALL map to `VARCHAR(255)` with a deterministic `CHECK` constraint. Generalization SHALL use joined tables where a child primary key is also a foreign key to its single parent. Many-to-many associations SHALL use an explicit composite-key join table. Aggregation SHALL have no delete cascade; supported unambiguous one-to-one and one-to-many composition SHALL use a non-null part foreign key and delete cascade.

#### Scenario: Joined child reuses the parent key
- **WHEN** a valid class has one generalization parent
- **THEN** its relational table uses a primary key that is also a foreign key to the parent table without an independent synthetic key

### Requirement: Relational mapping diagnostics and validation
The system SHALL validate relational-model invariants before exposing it to generators and SHALL return structured diagnostics for duplicate identifiers, invalid constraints, unsupported types, impossible multiplicities, inheritance cycles, and unsafe generated names.

#### Scenario: Invalid relational output is not consumable
- **WHEN** a mapping result violates a relational invariant
- **THEN** generation is blocked and diagnostics identify the failing relational element and source element when available
