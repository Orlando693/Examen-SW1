# spring-backend-generation Specification

## Purpose
Defines deterministic generation of a compilable Java 21 Spring Boot backend from the explicit relational model while keeping generated-backend behavior independent from the CASE application's own backend.

## Requirements

### Requirement: Deferred generator package options
The future Spring generator SHALL default its base package to `com.generated.app` and SHALL allow an explicit generator option to override it. It SHALL NOT derive the base package solely from mutable project metadata.

#### Scenario: Default base package remains stable
- **WHEN** no base-package option is supplied to a future generator
- **THEN** generated source uses `com.generated.app` regardless of project name changes

### Requirement: Deterministic generated Spring project
The system SHALL generate a complete Gradle-based Java 21 Spring Boot backend from a valid `RelationalModel`. Identical relational inputs and generation options SHALL produce identical relative paths, file contents, ordering, and manifest/hash output.

#### Scenario: Same relational model produces equal output
- **WHEN** the same valid relational model is generated twice in separate output directories
- **THEN** the relative file sets and content hashes are identical

#### Scenario: Unsafe output is rejected
- **WHEN** a generated path would escape the selected output root or collide after normalization
- **THEN** generation fails with a structured diagnostic and writes no unsafe path

### Requirement: Generated persistence and API behavior
The generated backend SHALL expose REST CRUD behavior for supported generated entities, including create, read, update, delete, list, count, pagination, sorting, filtering, search, and documented relationship navigation. It SHALL use the generated relational schema as its persistence authority and expose validation and stable API error responses without CASE application dependencies.

#### Scenario: Generated list applies query controls
- **WHEN** a valid generated entity list request includes supported pagination, sorting, filtering, or search parameters
- **THEN** the generated API applies only declared capabilities and returns a deterministic response shape

#### Scenario: Generated invalid request is safe
- **WHEN** a generated API request contains invalid validation data or unsupported query fields
- **THEN** it returns a stable validation error without persistence internals

### Requirement: Generated project build verification
The system SHALL provide a generated-project harness that uses the generated Gradle Wrapper and Java 21 to compile and run generated backend tests from a known canonical UML fixture. The harness SHALL verify regeneration determinism in addition to compile and test outcomes.

#### Scenario: Known fixture builds and tests
- **WHEN** Java 21 is available and the known UML fixture is generated
- **THEN** the harness runs the generated Gradle build and tests successfully without a globally installed Gradle

#### Scenario: Missing Java prerequisite is explicit
- **WHEN** Java 21 is unavailable or incompatible for the generated-project harness
- **THEN** the harness reports the prerequisite failure explicitly and does not claim generated-project verification passed
