## Context

See proposal.md for motivation. The canonical model currently prohibits equal association endpoints, has no endpoint role contract, and uses direct N:M associations. The relational mapper turns direct N:M into a hidden `JOIN`/`MANY_TO_MANY` representation and Spring emits `@ManyToMany`/`@JoinTable`.

`ProjectDocument.model` and `ProjectDocument.layout` are persisted in `ProjectResource`; document schema version 1 is the historical format. Local mutations use `UmlCommandBus` and snapshot history. Realtime decodes, normalizes, deduplicates, executes through the same bus, validates, CAS-persists, then broadcasts an authoritative result. React Flow remains a projection only.

## Goals / Non-Goals

**Goals:**

- Make role-aware recursive associations canonical, persisted, command-driven, replay-safe, and visible as self-loops.
- Establish association entities as the only representation of normal and recursive N:M after migration.
- Preserve the ordinary direct representation for recursive 1:N and generate unambiguous self FKs.
- Ensure the generated ZIP exactly reflects the persisted version-2 canonical document and provides usable CRUD acceptance paths.

**Non-Goals:**

- General UML association-class language features, composite keys, automatic destructive dematerialization, voice, CU-09, Flutter, CU-10/XMI, or a workspace redesign.
- Relaxing self-generalization or allowing self N:M without a relationship name and distinguishable roles.
- Retaining parallel direct-N:M/join-table generation after migration support is in place.

## Decisions

### 1. Endpoint roles and recursive validity

Extend each relationship endpoint with persisted optional `roleName`. The value is trimmed, validated as a usable generated property identifier when generation consumes it, and survives all document transports. Existing non-recursive relationships remain valid without roles.

An `ASSOCIATION` may use the same source and target class ID. `GENERALIZATION` continues to reject equal endpoints. A recursive 1:N association requires distinguishable endpoint roles when both generated navigations would otherwise collide; the example is `Empleado` with `jefe` at the `0..1` endpoint and `subordinados` at the `0..*` endpoint. The canonical validator is the single authority for these rules. Allowing a renderer-only loop is rejected because it would not persist or generate. Allowing self-generalization is rejected because it is semantically cyclic and remains invalid UML for this product.

### 2. Self-loop projection

The frontend adapter submits the normal relationship command with equal class IDs only for `ASSOCIATION`. The React Flow projection detects an accepted canonical self association and renders a deterministic non-degenerate self-loop with both multiplicities and endpoint roles. It never synthesizes, modifies, or deletes the canonical relation. Selection, inspector editing, deletion, reload, local undo/redo, and realtime ingestion operate on the same relationship ID.

### 3. Atomic association-entity materialization

Many means both endpoint multiplicity upper bounds are `*`. Creating a normal N:M or editing a direct normal association into N:M issues one atomic materialization command. The authority resolves every UUID, deterministic collision-safe class name, identifier attribute, replacement relation, and layout ID before execution. The executor removes the direct relation and creates one ordinary canonical class, identifier-marked `id: number`, two ordinary associations, and deterministic layout in one document snapshot.

Normal N:M names use source plus target class names in entered orientation, for example `AlumnoMateria`, appending a PascalCase relationship name when needed to distinguish repeated pairs and then a numeric collision suffix. The materialized class is normal editable `CanonicalUmlClass`, not a generator-only type. A compound sequence is rejected because it could leave partial state under undo or realtime.

### 4. Recursive N:M naming and role rules

A self N:M MUST provide a non-empty `relationshipName` and two distinct non-empty endpoint roles. The association entity name is the endpoint class name followed by the PascalCase relationship name, for example `PersonaAmistad`. The roles supply the two distinct association properties and FK bases: `personaOrigen` and `personaDestino` generate `persona_origen_id` and `persona_destino_id`.

The materialization command rejects missing, equal, invalid, or colliding self-N:M roles before mutation. It creates exactly two associations to the same `Persona` class, each retaining its role. This prevents duplicate Java properties and ambiguous same-table FKs. Automatically inventing roles is rejected because endpoint meaning cannot be inferred safely.

### 5. Lifecycle, history, persistence, and realtime

One local materialization produces one history snapshot: undo restores the direct relation or pre-edit state and redo restores the exact resolved IDs, name, roles, layout, and edges. Deleting a direct recursive association or a replacement association uses normal `DeleteRelationship`; deleting an association entity removes its edges through normal class deletion. No operation silently recreates a direct N:M or dematerializes an entity.

The realtime normalizer includes role fields and all authority-selected materialization values in its canonical digest. Existing command identity/digest dedupe, CAS commit point, normalized broadcast, and authoritative ingestion guarantee retry idempotence. Migration happens before join/generation processing; the renderer and clients never migrate or materialize from effects.

### 6. Version-1 to version-2 migration

Introduce an authoritative migration registry from document schema version 1 to 2. Version 2 forbids direct N:M. A normal legacy direct N:M migrates deterministically from relationship ID, endpoint IDs/order, multiplicities, valid roles and relationship name into one association entity, identifier attribute, two relations, and layout IDs. Version-2 reprocessing is a semantic no-op.

A self legacy N:M migrates only when its metadata contains a non-empty relationship name and two distinct valid roles that determine two references. If this information, plain association semantics, valid endpoints, multiplicities, or layout derivation is unavailable, migration returns `LEGACY_MANY_TO_MANY_MIGRATION_FAILED`, leaves the version-1 resource unchanged, and prevents edit, realtime join, mapping, and generation through the retired path. Migration runs inside the existing per-project authoritative coordinator and CAS-persists version 2 before continuing.

### 7. Relational and Spring mapping

A role-aware recursive 1:N maps to only `empleado` with nullable `jefe_id BIGINT REFERENCES empleado(id)`. Spring renders a valid self `@ManyToOne` with `@JoinColumn(name = "jefe_id")` and, where supported by existing navigation conventions, the inverse collection using the distinct `subordinados` role. No join table is used.

Materialized normal N:M maps `Alumno`, `Materia`, and `AlumnoMateria` as three ordinary entity tables. Materialized self N:M maps `Persona` and `PersonaAmistad`; the latter has a surrogate `id BIGINT` and two named FKs to `persona`. Spring generates ordinary entities and CRUD layers. `PersonaAmistad` has two `@ManyToOne` fields and two distinct `@JoinColumn` names. Remove `JOIN`, `MANY_TO_MANY`, `@ManyToMany`, `@JoinTable`, and their production template contexts after migration tests preserve historical coverage.

### 8. Generated ZIP acceptance

The generation endpoint consumes the persisted, migrated canonical document only. Automated harnesses extract the ZIP outside the repository and run Java 21 `gradlew.bat --no-daemon test` and `build`. The manual gate uses an isolated PostgreSQL database, starts the generated application, verifies Swagger/OpenAPI and the Postman collection, and executes create/read/update-if-supported/delete for: self 1:N (`Empleado` jefe/subordinado), normal N:M (`Alumno`, `Materia`, `AlumnoMateria`), and self N:M (`Persona`, `PersonaAmistad`). Database inspection verifies one self-FK table and two distinct same-table FKs.

## Risks / Trade-offs

- [Role names generate invalid or duplicate properties] -> Validate roles centrally before commands, mapping, or generation and fail closed.
- [Legacy self N:M lacks semantic metadata] -> Emit `LEGACY_MANY_TO_MANY_MIGRATION_FAILED`, preserve version 1, and prohibit fallback generation.
- [Migration races joins or commands] -> Serialize it in the existing project coordinator and CAS-persist before session creation or command handling.
- [Self-loop geometry obscures the node] -> Use deterministic projection geometry only; layout and semantics remain independent.
- [Generated PostgreSQL smoke affects CASE data] -> Require an isolated database and prohibit use of `examen_sw1`.

## Migration Plan

1. Add endpoint roles, recursive validation, and authoritative v1-to-v2 migration with fail-closed regressions.
2. Implement atomic normal/self N:M materialization and adapt editor, persistence, history, and realtime around the shared command path.
3. Replace direct N:M relational/Spring paths, verify generated ZIPs, and execute the isolated PostgreSQL/Swagger/Postman acceptance gate.
4. Roll back before release by reverting this change as a unit. A failed migration never changes the stored version-1 resource and never re-enables retired direct N:M generation.
