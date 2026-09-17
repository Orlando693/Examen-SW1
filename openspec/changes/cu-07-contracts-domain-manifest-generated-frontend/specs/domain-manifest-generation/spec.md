## Purpose

Defines a versioned, machine-readable domain manifest that safely joins generated relational semantics with generated API transport semantics.

## ADDED Requirements

### Requirement: Versioned Domain Manifest describes generated domain
The system SHALL generate a versioned Domain Manifest that declares each supported entity, field, type, relationship, alias, CRUD capability, validation, searchable field, and sortable field for a valid generated application.

#### Scenario: Manifest describes supported entity capabilities
- **WHEN** a valid relational model and compatible generated API contract are supplied
- **THEN** the manifest exposes only the entity fields, relations, validations, and permitted operations declared by those authorities

### Requirement: Manifest has split authorities
The system SHALL derive structural domain semantics, including entities, fields, types, and relations, from `RelationalModel`. It SHALL derive transport semantics, including operations, paths, methods, request and response schemas, and query controls, from OpenAPI where applicable.

#### Scenario: Transport details remain contract-derived
- **WHEN** an entity has a supported API operation
- **THEN** the manifest's operation mapping agrees with the OpenAPI contract and does not recreate an endpoint from UML or relational naming rules

### Requirement: Manifest consistency is validated
The system SHALL validate entity-to-API coverage, available operations, field restrictions, validations, searchable and sortable capabilities, and relationship mappings before exposing a manifest to downstream consumers.

#### Scenario: Structural and transport sources disagree
- **WHEN** a relational entity, field, relation, or capability cannot be reconciled with OpenAPI
- **THEN** manifest generation returns a structured failure identifying both affected source references and exposes no generatable partial manifest

### Requirement: Manifest generation is deterministic
The system SHALL emit stable manifest ordering, identifiers, aliases, and serialized content for equivalent relational and OpenAPI inputs. Output SHALL not contain runtime locations, timestamps, random values, or inferred undeclared capabilities.

#### Scenario: Equivalent inputs produce equal manifests
- **WHEN** equivalent relational models and OpenAPI contracts differ only in input ordering
- **THEN** their generated manifests are byte-equivalent after canonical serialization
