## ADDED Requirements

### Requirement: Atomic many-to-many association materialization
The system SHALL detect a many-to-many association when both existing endpoint multiplicity upper bounds represent many and SHALL replace that direct association atomically with one normal canonical association class and exactly two canonical replacement associations. The resulting class SHALL have a stable persisted identity and SHALL be valid for normal class editing.

#### Scenario: Create a many-to-many association
- **WHEN** a user creates an association whose two endpoint upper bounds represent many
- **THEN** the document contains the two original classes, one association class, exactly two replacement relationships, and no direct many-to-many relationship

#### Scenario: Update an association into many-to-many
- **WHEN** a user updates an existing association so both endpoint upper bounds represent many
- **THEN** the same atomic materialization result is committed as one canonical mutation

#### Scenario: One-to-many remains direct
- **WHEN** either endpoint upper bound does not represent many
- **THEN** the system retains the ordinary direct association and creates no association class

### Requirement: Stable association-class identity and naming
The system SHALL assign every materialized association class a real stable identifier and a deterministic readable name derived from both endpoint class names and, when needed, the relationship name. It SHALL resolve name collisions without overwriting an existing class or relying only on a UUID.

#### Scenario: Resolve a class-name collision
- **WHEN** the preferred association-class name already exists
- **THEN** the materialized class receives a distinct deterministic alternative name and all generated identifiers remain stable for that command result

#### Scenario: Distinguish multiple relationships between one pair
- **WHEN** two named many-to-many relationships connect the same two classes
- **THEN** each materialization produces a distinct association class and no class is reused accidentally

### Requirement: Safe lifecycle of materialized associations
The system SHALL preserve an association class after it has been materialized when later edits make a replacement relationship no longer many-to-many. Class and relationship deletion SHALL remove invalid references according to the existing canonical invariants and SHALL reject dangling references.

#### Scenario: Do not silently dematerialize
- **WHEN** a modeler changes multiplicity after an association class was materialized
- **THEN** the system does not silently delete the association class or its user-editable data

#### Scenario: Delete a participant class
- **WHEN** a class participating in a materialized association is deleted
- **THEN** all relationships referencing the deleted class are removed and no remaining relationship references a missing class

### Requirement: Versioned historical many-to-many migration
The system SHALL migrate a supported historical canonical direct many-to-many association through the persisted document schema migration path into the sole version-2 association-class representation. The migration SHALL derive stable IDs deterministically from the historical relationship identity, preserve representable relationship name, endpoint identity, multiplicities, and roles, create an identifier-marked `number` attribute, and remove the historical direct association.

#### Scenario: Migrate a historical direct relationship
- **WHEN** a version-1 project document contains a valid direct many-to-many association
- **THEN** the version-2 result contains one deterministic association class, its identifier-marked `number` attribute, exactly two replacement relationships, and no direct many-to-many association

#### Scenario: Repeat migration
- **WHEN** an already migrated version-2 document is processed again
- **THEN** migration is a semantic no-op and creates no additional class, attribute, layout entry, or relationship

#### Scenario: Reject unmappable historical semantics
- **WHEN** a historical many-to-many relationship has malformed references, unsupported metadata, or aggregation/composition semantics that cannot be represented safely
- **THEN** migration fails with an actionable relationship-referenced diagnostic and does not discard the historical metadata
