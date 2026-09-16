# CU-06 - UML To Relational Model And Generated Spring Backend

## Objective

Implement a deterministic pipeline from `CanonicalUmlModel` to an explicit `RelationalModel` and later a compilable Java 21 Spring Boot backend. Incremento 1 is implemented; Incrementos 2 and 3 have not started.

## Preconditions

- CU-00 through CU-05 and the two corrective changes are closed, archived, and pushed.
- `CanonicalUmlModel`, validation, persistence, commands, history, and realtime collaboration already exist.
- No OpenSpec change was active before this proposal.
- Java 21 is not verified: current `java --version` and `javac --version` do not succeed. No Java or Gradle installation is performed during proposal.

## Scope

- Deterministic UML-to-relational transformation and independent relational contracts.
- Handlebars-based Java 21 / Spring Boot 4.x / Gradle / JPA/Hibernate / PostgreSQL backend generation.
- Generated CRUD, count, pagination, sorting, filtering, search, relationship navigation, validation, errors, and springdoc setup.
- Determinism, template, generated-project compilation, and generated-test harness strategy.

## Out Of Scope

- Generated frontend, Postman, Domain Manifest, CU-07 OpenAPI-derived artifacts, Flutter, assistants, XMI, image, AWS, offline enhancements, Prisma schema/migrations, and realtime changes.

## Actors

- Modeler: supplies a valid persisted canonical UML model for generation.
- Generator: deterministically maps and renders approved semantics.
- Verifier: executes Node tests and, after Java 21 setup, generated Gradle verification.

## Conceptual Flow

```text
CanonicalUmlModel (semantic only)
  -> canonical validation
  -> RelationalMapper
  -> RelationalModel + diagnostics
  -> SpringGenerator + Handlebars templates
  -> generated Gradle/Spring project
  -> Gradle Wrapper build and generated tests
```

`DiagramLayout`, React Flow, NestJS CASE APIs, Prisma, and CU-05 protocol do not enter this flow.

## Approved Decisions

- Packages: retain `packages/uml-core`; Incremento 1 adds `packages/relational-core`; `packages/spring-generator` and Handlebars remain Incremento 2 work.
- PK: separate relational identifier metadata explicitly references a numeric attribute. No attribute-name convention creates a key. Invalid hints block mapping; absent valid metadata receives synthetic generated identity `id`.
- Inheritance: JPA `JOINED`, direct parent PK/FK. Single table and table-per-class were rejected for CU-06.
- N:M: deterministic sorted join-table name, two non-null FKs, sorted composite PK, and stable constraints.
- Enums: future Java enum plus PostgreSQL `VARCHAR(255)` with named `CHECK`; future JPA uses `EnumType.STRING`. Native PostgreSQL enum is excluded.
- Aggregation: ordinary association mapping with no cascade. Composition: non-null part FK, `ON DELETE CASCADE`, and JPA cascade/orphan semantics only for unambiguous 1:1/1:N cases.
- Naming: ASCII lower snake_case SQL, reserved-word suffix, 63-byte PostgreSQL cap, stable source-ID hash suffix for collisions, sorted collections.
- Initial primitive types: string/String/VARCHAR(255), number/BigDecimal/NUMERIC, boolean/Boolean/BOOLEAN, date/LocalDate/DATE, datetime/Instant/TIMESTAMPTZ; void is invalid for attributes. PKs use Long/BIGINT.

## Rules And Validation

- A valid canonical model is mandatory; mapper diagnostics block output for unsupported/ambiguous cases.
- Metadata `required`, `unique`, `searchable`, and `sortable` map to documented nullability, constraints, and indexes; no invisible inference is permitted.
- Missing relationship multiplicities, finite multiplicity upper bounds greater than one, custom attribute types, multiple inheritance, inheritance cycles, and unsupported composition forms are proposed blockers until an approved rule exists.
- All naming, IDs, collection ordering, output paths, templates, and manifest hashes are deterministic.

## Increments

### Increment 1 - RelationalModel And RelationalMapper

Create relational contracts, mapper, naming, mapper validation/errors, explicit keys/constraints/enums/relations/inheritance behavior, exhaustive unit tests, determinism tests, and focused golden tests. Result: valid canonical UML maps to a stable relational model. No Java installation is required.

### Increment 2 - Spring Generator Foundation

Create generator workspace, Handlebars dependency/templates, deterministic file planning/writing, Gradle/Spring structure, Java entities, repositories, DTOs/mappers, services, controllers, validation/errors/configuration, PostgreSQL and springdoc configuration, wrapper strategy, and template/file tests. Java 21 must be verified before any actual generated-project toolchain check.

### Increment 3 - Advanced CRUD And Generated-Project Harness

Complete CRUD/count/pagination/sorting/filtering/search/relationship navigation, add known UML fixture, generate real project, compare regeneration output, run generated Gradle build/tests under Java 21, and document actual results. Result: known UML to generated backend build/test pass.

## Test Strategy

- Mapper: classes, attributes, primitives, PK/FK, nullability, unique/indexes, enums, all relations, naming/reserved/collision handling, ordering, malformed/unsupported sources, and determinism.
- Generator: paths, ordering, path traversal prevention, templates, all generated layers, Gradle files, and semantic artifact assertions rather than snapshots alone.
- Harness: fixture-to-model-to-project output equality/hash, Java 21 compilation, generated Gradle tests, Spring context/API tests where appropriate, and PostgreSQL configuration expectations. No sleeps, arbitrary retries, skipped tests, or flaky timing dependencies.

## Implementation Performed

Incremento 1 created `packages/relational-core`, a framework-independent npm workspace depending only on `@examen-sw1/uml-core`. Its public API exposes relational tables, columns, PK/FK, unique/check constraints, indexes, relations, enums, diagnostics, separate `RelationalGenerationMetadata`, `RelationalMappingResult`, and `mapCanonicalUmlModel()`.

- The mapper is deterministic and fail-closed. It implements synthetic/explicit PKs, approved primitive/enum mappings, FK indexes without redundant PK/unique prefixes, 1:1, 1:N, N:M joins, aggregation, composition cascade metadata, and JOINED inheritance.
- Canonical UML is unchanged; identifier hints are external metadata keyed by class and attribute IDs.
- Java, Gradle, Handlebars, SpringGenerator, generated Java, Prisma, and realtime behavior were not changed.

## Automated Evidence

- Relational core: 10 tests PASS; typecheck, lint, and build PASS.
- Root typecheck, lint, and build PASS. Root scripts now explicitly build relational-core.
- Fresh root validation passed: frontend 176, backend 159 (including 36 realtime PostgreSQL/Socket.IO integration tests), UML core 36, and relational core 10: 381/381 total with zero skips or failures. An ephemeral JWT and explicit isolated `TEST_DATABASE_URL` were used only for that process.
- OpenSpec change strict and main specs strict PASS. `git diff --check` PASS with known Windows line-ending warnings.

## Future Acceptance

- Approved decisions are implemented within this single OpenSpec change.
- Known valid UML deterministically produces an equivalent relational model on repeated generation.
- Incremento 2 will add files; Incremento 3 will prove generated Gradle compilation and tests using Java 21.
- Relevant root checks and OpenSpec strict validation pass, with actual outcomes documented before acceptance.

## Known Limitations And Debt

- Java 21 is not currently verified. This does not block Increment 1.
- Java 21 remains unverified and is not required until Incremento 2/3. No Java, Gradle, Handlebars, Spring generator, generated Java, Prisma schema/migration, realtime, or frontend implementation change belongs to this increment.
