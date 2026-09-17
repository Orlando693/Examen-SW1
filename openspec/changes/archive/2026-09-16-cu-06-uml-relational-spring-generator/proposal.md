## Why

The CASE application has a validated, persisted, collaborative `CanonicalUmlModel`, but it cannot yet transform that semantic model into a deterministic relational representation or executable application. CU-06 establishes the deterministic generation boundary required before contracts, frontend generation, and assistant capabilities in later CUs.

## What Changes

- Add a framework-independent `RelationalModel` and deterministic `RelationalMapper` from `CanonicalUmlModel` plus optional relational generation metadata, without consuming `DiagramLayout` or modifying canonical UML data.
- Define explicit relational rules for identifiers, PostgreSQL types, constraints, enum values, multiplicities, aggregation/composition, inheritance, naming, collisions, ordering, and unsupported models.
- Add a separate Handlebars-based Spring generator that transforms a `RelationalModel` into a Java 21, Spring Boot 4.x, Gradle, PostgreSQL backend.
- Generate CRUD-oriented Spring artifacts, validation, error handling, relationship navigation, pagination, sorting, filtering, search, and springdoc configuration.
- Add deterministic generator verification and a generated-project harness that compiles and tests a known generated backend using Java 21 and the Gradle Wrapper.

## Capabilities

### New Capabilities
- `uml-relational-mapping`: Deterministically transform valid canonical UML into an explicit, ordered relational model with structured mapping diagnostics.
- `spring-backend-generation`: Deterministically generate and verify a Gradle-based Java 21 Spring Boot backend from the relational model.

### Modified Capabilities

- None.

## Impact

- Increment 1 creates only `@examen-sw1/relational-core`; `@examen-sw1/spring-generator` remains a later Increment 2 workspace. `@examen-sw1/uml-core` remains a UML-only dependency.
- `handlebars` and any related types are deferred to Increment 2. Increment 1 introduces no third-party dependency.
- Root workspace scripts will later include the new packages and generated-project harness. Frontend, NestJS, Prisma schema/migrations, persistence APIs, and CU-05 realtime protocol are not changed.
- Java 21 is an external prerequisite for generator-project compilation. The current shell does not accept `java --version` or `javac --version`, so Java 21 availability is not established and no installation is performed in this proposal.
