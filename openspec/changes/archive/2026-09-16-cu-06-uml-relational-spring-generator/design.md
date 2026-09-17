## Context

See `proposal.md` for motivation and the two delta specs for behavioral requirements. The current `@examen-sw1/uml-core` is framework-independent and exports `CanonicalUmlModel`, validation, serialization, commands, history, and persistence envelopes. Its semantic types are classes, attributes, enumerations, relationships, packages, stable UUIDs, multiplicities, and `GenerationMetadata`. It has no identifier/index metadata and its current primitive set is `string`, `number`, `boolean`, `date`, `datetime`, and `void`.

`ProjectDocument.model` is the sole semantic input. `ProjectDocument.layout`, React Flow, NestJS/Prisma persistence, and CU-05 Socket.IO protocol are intentionally outside this pipeline. Current canonical validation checks structural validity, references, names, and multiplicity, but does not establish all generation constraints; CU-06 therefore adds generation-boundary validation without changing source semantics.

The local Java command is present but rejects `--version`, and `javac --version` also fails. Java 21 is therefore not currently verified. No Java or Gradle installation is part of this proposal.

## Goals / Non-Goals

**Goals:**

- Make `CanonicalUmlModel -> RelationalModel -> generated Spring project` deterministic, inspectable, and independently testable.
- Preserve `uml-core` as a UML-domain package and ensure the generator never needs frontend, NestJS, Prisma, database, or realtime imports.
- Generate Java 21 / Spring Boot 4.x / Gradle / Spring Web MVC / Spring Data JPA / Hibernate / Jakarta Validation / Jackson / PostgreSQL / springdoc-openapi artifacts.
- Prove generated code with semantic unit tests and a real generated-project Gradle harness.

**Non-Goals:**

- Changing UML commands, persistence format, Prisma schema/migrations, project APIs, collaboration, or frontend behavior.
- Generating frontend, Postman Collection, Domain Manifest, assistant, mobile, XMI, AWS, or CU-07 responsibilities.
- Inventing business rules, executing generated code from IA output, or accepting arbitrary SQL/URLs.

## Decisions

### 1. Package boundaries

Create three dependency-directional workspaces:

```text
packages/uml-core                 Canonical UML only (existing; no generator logic)
packages/relational-core          Relational contracts, mapper, mapper validation
packages/spring-generator         Handlebars templates, file planner/writer, harness utilities
```

`relational-core` depends only on `@examen-sw1/uml-core`. It is the sole Increment 1 package. `spring-generator` remains deferred to Increment 2 and will depend only on `@examen-sw1/relational-core` plus Handlebars. Test fixtures live in the owning package test directories; the generated-project harness and checked-in source fixture remain deferred.

This is preferred over extending `uml-core` because relational semantics are not UML semantics and importing Handlebars/generator concerns would weaken its framework-agnostic boundary. It is preferred over placing generation in `frontend` or `backend` because neither CASE delivery application owns generated-backend domain logic. A single generator package was considered, but separates mapping testability and would make later non-Spring generators import template dependencies.

### 2. Relational model contract and determinism

`RelationalModel` will be plain serializable data, conceptually:

```text
{ version, schema, enums[], tables[], relations[], diagnostics? }
table: { id, name, sourceClassId, columns[], primaryKey, foreignKeys[], uniqueConstraints[], indexes[] }
column: { id, name, sourceAttributeId?, sqlType, javaType, nullable, generated, enumId? }
relation: { id, kind, sourceRelationshipId, tableIds, ownership, navigation }
```

All collections are sorted by stable normalized names, then stable source UUID. Any derived ID/name uses an explicit domain prefix plus source UUID-derived deterministic suffix, never random UUIDs. Canonical input arrays are normalized before mapping. Input object property order is irrelevant. Mapper and relational validation diagnostics use structured `{ severity, code, message, path, sourceElementId?, relationalElementId? }` records.

The mapper first runs existing canonical validation and rejects blocking diagnostics. It then runs generation validation for unsupported/ambiguous semantics, derives tables/types/keys, maps relationships and inheritance, resolves names globally, sorts every collection, and validates the output before returning it. It never reads `DiagramLayout`.

### 3. Classes, attributes, primary keys, and types

Each UML class maps to one table unless it participates as a subclass in the selected inheritance strategy. Each primitive or enum UML attribute maps to one scalar column. Canonical `GenerationMetadata` is not relational input. Increment 1 accepts a separate `RelationalGenerationMetadata` keyed by class ID, with at most one `identifierAttributeId` per class. No attribute name implies identifier behavior. Every entity table has exactly one primary key: a valid explicit `number` identifier maps to `BIGINT` / future `Long`; otherwise the mapper adds `id BIGINT GENERATED BY DEFAULT AS IDENTITY`. Invalid explicit metadata is blocking and never falls back to a synthetic key. The existing UML `required` and `unique` metadata remain semantic generation hints for nullability and unique constraints; FK indexes are automatically generated and redundant PK/unique indexes are omitted.

Initial primitive mapping is:

| UML primitive | Java/JPA | PostgreSQL |
| --- | --- | --- |
| `string` | `String` | `VARCHAR(255)` |
| `number` | `BigDecimal` | `NUMERIC` |
| `boolean` | `Boolean` | `BOOLEAN` |
| `date` | `LocalDate` | `DATE` |
| `datetime` | `Instant` | `TIMESTAMP WITH TIME ZONE` |
| `void` | unsupported attribute type | generation error |

`custom` types and class-typed attributes are blocking in CU-06 unless modeled as supported UML relationships; this prevents guessing persistence semantics. `void` is never persistible. Decimal, UUID, text/unbounded string, binary, and default values are deliberately deferred until canonical metadata explicitly represents them.

### 4. Naming, constraints, and collisions

Names convert Unicode-normalized UML names to ASCII lower `snake_case`, replace invalid runs with `_`, trim separators, prefix `_` when required, and append `_` for PostgreSQL reserved words. Identifiers are capped at PostgreSQL's 63-byte limit. Collisions retain a truncated readable base plus the first eight hexadecimal characters of a stable hash of the canonical source ID; hash-prefix extension resolves the unlikely collision. Constraint names use `pk_`, `fk_`, `uq_`, and `ix_` plus provenance and the same cap. Illegal/empty names after normalization are blocking diagnostics.

### 5. Associations, cardinality, aggregation, and composition

Endpoint multiplicity is interpreted from the opposite object: if target upper bound is many, each source instance can reference many targets. Missing multiplicity is ambiguous and blocks relational mapping; implicit multiplicities are not invented.

- `1:N`: place the FK on the N-side table. Its nullability follows the lower bound at the 1-side endpoint: lower `>= 1` is non-null; `0` is nullable. Generate a relation with owning N-side navigation.
- `1:1`: choose one owner deterministically from association ends by stable table name then relationship ID. Place one FK in owner table, add `UNIQUE`, and derive nullability from the opposite endpoint lower bound.
- `N:M`: generate a join table named from the two sorted table names plus relationship suffix when needed. It has the two non-null FK columns, deterministic composite PK in sorted table order, FKs, and a unique equivalent only when no PK already provides it. A relationship name contributes before the UUID collision suffix.
- Aggregation uses the same FK/table strategy as association and has no database cascade by default; it records shared ownership in relation metadata.
- Composition uses the same multiplicity strategy, but only supports unambiguous 1:1/1:N owner-to-part direction. The part-side FK is non-null, uses `ON DELETE CASCADE`, and records future orphan semantics. Composition N:M, nullable part FKs, and ambiguous ownership are blocking.

Self associations, duplicate semantic relationships, both ends many with composition/aggregation, and finite upper bounds above one are not silently approximated. The first two may be mapped only after a concrete rule is approved; finite bounds greater than one cannot be enforced by a simple relational FK and are reported as unsupported in CU-06.

### 6. Enums and inheritance

Each UML enumeration becomes a future Java enum and a PostgreSQL `VARCHAR(255)` column with a named `CHECK` constraint containing stable enum literal values. Future JPA uses `EnumType.STRING`. PostgreSQL native enums are rejected for CU-06. Empty enums and literals that cannot be represented as deterministic legal Java identifiers are blocking errors.

Inheritance proposal: use JPA `JOINED` inheritance. The root class has its normal table/PK. Each subclass has its own table whose PK is also a non-null FK to the direct parent. JPA uses `@Inheritance(strategy = JOINED)` at a root and `@PrimaryKeyJoinColumn` on subclasses. Single-table was rejected because nullable subclass columns and discriminator management obscure the explicit relational model; table-per-class was rejected because polymorphic queries and duplicate inherited columns are more expensive and less conventional for generated CRUD. Multiple inheritance, cycles, and a class that has more than one direct generalization are blocking diagnostics. Generalization orientation follows current UML conventions: relationship `source` is child and `target` is parent, verified in mapping tests.

### 7. Spring project generation

`spring-generator` uses Handlebars templates only for Java, Gradle, properties/YAML, and test source; small non-code metadata such as a file manifest may use deterministic JSON serialization. A two-phase generator builds an ordered in-memory file plan, validates normalized relative paths and duplicate contents, renders templates with escaped structured context, and writes only under caller-selected output root. Template helpers are pure and registered centrally.

The generated project layout is:

```text
generated-backend/
  build.gradle
  settings.gradle
  gradlew, gradlew.bat, gradle/wrapper/
  src/main/java/<base-package>/{domain,persistence,application,api,validation,errors,config}/
  src/main/resources/application.yml
  src/test/java/<base-package>/
```

The future base package defaults to `com.generated.app` and only a future `SpringGeneratorOptions.basePackage` may override it; project naming is not an implicit base-package input. Per-entity generation remains deferred. Routes and response envelope naming do not become a CU-07 contract; CU-07 owns derived OpenAPI/Postman/Domain Manifest responsibilities.

Gradle Wrapper is committed into each generated project from version-controlled generator assets with hashes verified by generator tests. No global Gradle is needed. Java 21 is needed before Increment 2 template/toolchain verification and mandatory for Increment 3 compilation. Future checks are `java --version` and `javac --version`; both must report 21 before harness execution.

### 8. Test strategy and boundaries

Increment 1 unit tests cover every mapping rule, invalid source/model diagnostic, canonical array/key-order determinism, collision naming, and selected golden relational models. Golden tests only cover compact representative fixtures; semantic assertions inspect tables, constraints, keys, and relations.

Increment 2 tests inspect file plans, safe paths, template rendering, generated Java fragments/AST-or-compiler-friendly syntax checks, structural artifacts, and exact repeated-output hashes. They do not rely only on snapshots.

Increment 3 uses a known canonical fixture with customers/orders/products-like neutral relationships, enum, composition, joined inheritance, metadata flags, and no business-specific assumptions. It maps, generates twice, compares paths/content hashes, runs `gradlew test` with Java 21, and asserts generated API/service/repository behavior. The harness has bounded command timeouts for process failure reporting, never sleeps/retries to achieve correctness, and always cleans temporary outputs.

## Risks / Trade-offs

- [Current UML metadata lacks explicit identifier/index/default/length semantics] -> Add only the minimal approved identifier/index metadata or reject unsupported requests explicitly; do not infer hidden database policy.
- [Composition semantics exceed FK shape] -> Restrict to unambiguous one-to-one/one-to-many ownership and make unsupported composition blocking.
- [Spring Boot 4.x dependency coordinates or Java baseline may differ at implementation time] -> Verify supported release coordinates against official Gradle/Spring documentation before dependency installation; record exact versions and avoid substituting frameworks.
- [Java 21 is not confirmed locally] -> Increment 1 remains Node-only; install/configure Java 21 only before generated project compilation and record exact version evidence.
- [Generated builds may require network access for Gradle dependencies] -> Cache only through normal Gradle behavior and report environmental resolution failures separately from generator correctness.

## Migration Plan

1. Add packages and Node-only relational mapper tests without modifying canonical types except an explicitly approved minimal metadata extension.
2. Add Handlebars generator and static generation tests, then version-controlled wrapper assets.
3. Verify Java 21, execute isolated generated-project compilation/tests, and record exact artifact/toolchain versions.
4. No database migration or CASE API migration is expected. Rollback removes the new packages and generated outputs; persisted `ProjectDocument` remains unchanged unless approved identifier/index metadata is introduced, in which case backward-compatible optional decoding is required and documented.

## Approved Decision Record

The identifier metadata boundary, `JOINED` inheritance, `VARCHAR(255) + CHECK` enums, composition restrictions, fail-closed unsupported policy, automatic relation indexes, and `com.generated.app` future base-package default are approved. No Spring generator, Java, Gradle, or Handlebars work belongs to Increment 1.
