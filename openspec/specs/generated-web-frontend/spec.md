# generated-web-frontend Specification

## Purpose

Defines deterministic generation of an independently runnable responsive web CRUD application from generated API and domain contracts.

## Requirements

### Requirement: Generated frontend consumes generated contracts
The system SHALL generate an independent Next.js App Router, TypeScript, and Material UI frontend from generated OpenAPI and Domain Manifest inputs. The generated frontend SHALL not read Canonical UML, reconstruct relational rules, or maintain manually defined API endpoint routes.

#### Scenario: Generated client follows contract transport
- **WHEN** a valid OpenAPI contract and Domain Manifest are supplied
- **THEN** generated API interactions use only the contract-derived operation mappings, paths, methods, parameters, and schemas

### Requirement: Generated frontend provides visual CRUD
The generated frontend SHALL provide entity list, detail, create, edit, and delete interactions for declared CRUD capabilities; relationship navigation; search, declared filters, pagination, and declared sorting; and loading, error, and empty states.

#### Scenario: User operates a generated entity
- **WHEN** a user opens an entity with declared CRUD capability
- **THEN** the generated frontend presents the allowed list, detail, form, and relationship interactions and communicates only through the declared contract operation

### Requirement: Generated forms infer declared controls
The generated frontend SHALL render controls from Domain Manifest field types and constraints: text input, number input, boolean control, date control, date-time control, enum selection, multiline text control, and relationship selection or related list where declared. It SHALL enforce declared required and validation constraints before sending a request.

#### Scenario: Form applies manifest constraints
- **WHEN** a user creates or edits an entity field with a declared type and validation
- **THEN** the form uses the corresponding control and presents the declared validation failure without inventing an unsupported field or value

### Requirement: Generated frontend is responsive and contract-safe
The generated frontend SHALL provide responsive navigation and usable list, detail, and form views on supported desktop and mobile viewport sizes. A missing, invalid, or incompatible contract or manifest SHALL display a safe application error and SHALL not issue guessed network requests.

#### Scenario: Contract mismatch is safe
- **WHEN** the generated frontend detects incompatible contract or manifest input
- **THEN** it displays an error state and prevents unsupported CRUD interactions

### Requirement: Generated frontend output is deterministic and executable
The system SHALL produce identical generated frontend paths and contents for equivalent OpenAPI, Domain Manifest, and generation options. The known generated frontend SHALL install, build, test, and complete real-browser CRUD verification against the known generated backend.

#### Scenario: Regenerated frontend is equivalent
- **WHEN** the same generated contracts are materialized twice in separate output roots
- **THEN** their relative paths, content hashes, and manifest are identical and each generated project completes its required build and test checks
