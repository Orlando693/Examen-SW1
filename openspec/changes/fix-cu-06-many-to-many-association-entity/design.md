## Context

See proposal.md for motivation. The present canonical model represents N:M as one ordinary association whose endpoint multiplicities each have `upper: '*'`. The relational mapper converts it to a `JOIN` table with two-FK composite key and a `MANY_TO_MANY` relation; Spring then renders `@ManyToMany` and `@JoinTable`. This is the only current N:M route, but it makes the generated semantic entity invisible in `ProjectDocument`.

`ProjectDocument.model` and `ProjectDocument.layout` are persisted JSON inside `ProjectResource`. The resource already has `documentSchemaVersion`, but its current decoder supports only version `1` and has no migration registry. Local mutations use `UmlCommandBus` and snapshot history. Realtime decodes, authority-normalizes, deduplicates, executes through that bus, validates, CAS-persists, then broadcasts one normalized command. React Flow is a projection. The active CU-09 and CU-10 working-tree changes are outside this change.

## Goals / Non-Goals

**Goals:**

- Establish one canonical N:M strategy: materialized normal class plus two normal relationships in `CanonicalUmlModel`.
- Make the transformation deterministic, atomic, persistible, undoable locally, and reproducible from the realtime authority result.
- Remove direct join-table and direct JPA N:M rendering so `RelationalModel` and generated Spring source consume only the materialized form.

**Non-Goals:**

- General UML association-class language features, composite keys, XMI, Flutter, assistant, voice, or UI redesign.
- Self many-to-many relations. The editor currently rejects same-class associations and commands do not carry the role data needed to model them safely.
- Automatic destructive reversal after materialization or generated cascading deletes beyond current conventions.

## Decisions

### 1. One explicit canonical transformation

Add one typed `MaterializeManyToManyAssociation` command, used by the editor adapter when creating an N:M association and when updating an existing direct association into N:M. Its executor validates distinct endpoint classes and both canonical upper bounds as many, then in one immutable document result:

1. removes the existing direct relationship when one exists;
2. creates a normal UML class;
3. creates its explicit `id: number` attribute with persisted `generation.identifier: true`; this is a minimal extension to the current attribute generation metadata and maps to `BIGINT`/Java `Long` rather than a composite key;
4. creates two replacement associations, each expressing association-class many-to-one to an original class under the existing endpoint orientation; and
5. creates a `DiagramLayout` entry at the endpoint midpoint plus a fixed deterministic offset.

The class is ordinary `CanonicalUmlClass`; no second model type or generator-only entity is introduced. The command includes all resulting stable IDs and resolved name after authority normalization. A create/update request that is not N:M continues to use the existing relation commands. The executor does not leave a direct N:M relation, partial class, or one replacement edge. `number` remains the exact canonical primitive because that is the current primitive union; as an ordinary scalar it maps to `NUMERIC`/`BigDecimal`, while the new persisted identifier flag deliberately selects the existing identifier convention of `BIGINT`/`Long`.

An alternative that only derives a generated association entity from the direct N:M relation is rejected because the editor and persisted semantic model would remain inconsistent with generated behavior. A compound client sequence of existing create commands is rejected because it is not atomic under history or realtime.

### 2. Existing multiplicity format and naming policy

Many means the real existing `upper` representation is `'*'`; canonical range values such as `0..*` and `1..*` already normalize to this upper bound. No new multiplicity syntax is introduced.

The preferred class name is source class name plus target class name in user-entered association orientation, for example `AlumnoMateria`. For a second relationship between the same classes, a non-empty relationship name is appended in PascalCase before collision resolution, for example `UsuarioRolRoles` and `UsuarioRolFavoritos`. If the candidate conflicts with an existing class, append the smallest positive decimal suffix (`AlumnoMateria2`, then `AlumnoMateria3`) that is unused. The executor calculates the name once from the authoritative base document; the normalized command carries it and the server-selected UUIDs, making redo/replay exact and preventing render/reload duplicates.

### 3. Lifecycle, deletion, and changing multiplicities

Materialization is irreversible without a future explicit destructive command. Editing a replacement relationship to no longer have the intended cardinality does not delete the association class, its identifier, attributes, or remaining relationships. That preserves user additions safely; relational validation can reject an unsupported resulting shape rather than guessing.

The normal `DeleteRelationship` operation removes only the selected replacement relationship. It does not recreate the direct N:M relation or delete the class. Normal `DeleteClass` removes all relationships referencing that class and its layout entry; deleting the association class therefore removes both replacement edges, while deleting either endpoint removes its edges and prevents dangling references. Existing model validation remains the single reference-invariant authority.

### 4. History, persistence, and realtime

The command bus returns one document snapshot, so local `UmlHistory` records one entry: one undo restores the prior direct relationship or pre-update model, and one redo restores exactly the same class IDs, names, layout and edges. Realtime continues to disable snapshot undo.

The realtime normalizer selects every missing resulting class/attribute/relationship/layout ID before execution and incorporates the strict command in its current canonical digest. Existing session queue, `(projectId, sessionId, commandId)`/digest dedupe, CAS commit point, and normalized result broadcast make retry idempotent. No React effect, persistence reload, or client sync can invoke materialization. A concurrent second user works from stale bases and must resynchronize; it cannot add a second entity for the accepted operation.

### 5. Historical document migration

Introduce a minimal versioned migration registry at the persistence decode boundary and advance migrated resources from `documentSchemaVersion: 1` to `2`. The authoritative project service invokes it before semantic validation, command handling, realtime join, relational mapping, or Spring generation. It converts every historical direct N:M association once, validates the complete candidate, and durably CAS-persists the version-2 `ProjectResource` before returning or broadcasting it. React, the canvas, and ordinary reload do not perform the transformation.

For each legacy direct association, migration derives the association class, identifier attribute, two replacement relationship IDs, and layout-node ID deterministically from the historical relationship UUID plus fixed purpose suffixes. It uses the historical endpoint order, endpoint class IDs, multiplicity lower/upper information, valid role names, and a non-empty relationship name in the deterministic association-class naming candidate. It preserves association kind only for a plain UML association. Historical N:M aggregation or composition, malformed references/multiplicities, unsupported metadata, or any value that cannot be represented by the new ordinary class/two-association form fails closed with an actionable `LEGACY_MANY_TO_MANY_MIGRATION_FAILED` diagnostic; it is neither discarded nor generated through the legacy path.

Version `2` has no direct N:M associations. Re-running the registry on version `2`, saving/reloading it, or receiving it by realtime is a semantic no-op, so it cannot create another association class. Existing valid version-1 documents without direct N:M only receive the version transition with equivalent canonical semantics. This uses the existing resource version rather than introducing an independent model-version field.

### 6. Relational and Spring simplification

`relational-core` maps the resulting three normal classes and two relationships. `AlumnoMateria` is an `ENTITY` table with `id BIGINT` and two non-null foreign keys, using existing SQL names and constraints. Remove `JOIN` tables and `MANY_TO_MANY` relation kind/path for this former direct case rather than supporting both representations.

Spring consumes only ordinary entity tables and FK relationships: the link entity has generated-id JPA persistence and two `@ManyToOne` fields; endpoint collections use current normal relationship conventions where applicable. It produces the same repository/service/controller/DTO layers and CRUD routes as other generated entities. Remove `ManyToMany` context generation, `@JoinTable` template output, direct-N:M fixture assertions, and the direct join-table mapper branch. This is a deliberate internal contract break, contained in the workspace packages.

### 7. Explicit unsupported cases

Self N:M is rejected clearly before materialization because distinct endpoint role names are not available through the editor/realtime command contract. Multiple N:M associations between the same distinct classes are supported through relationship-name-aware candidates and deterministic numeric collision suffixes. Missing/invalid endpoint references and any attempted dangling result are rejected before mutation.

## Risks / Trade-offs

- [Historical migration write races a command or join] -> Run version migration inside the existing authoritative per-project coordinator and persist version `2` before normal command/session processing.
- [Legacy metadata cannot be represented] -> Fail closed with a relationship-referenced migration diagnostic; retain the stored version-1 resource unchanged for repair rather than silently dropping semantics.
- [Normal class identifier appears as canonical `number`] -> Add only persisted `generation.identifier`; reuse the existing identifier mapping to Java `Long`/SQL `BIGINT` and do not expand canonical primitive types.
- [Relationship orientation may be misunderstood] -> Assert resulting FK ownership and generated Java annotations with domain, mapper, source, and real Gradle tests.
- [Association class placement overlaps nodes] -> Use deterministic midpoint offset only; layout remains secondary and model correctness does not depend on it.
- [Generated PostgreSQL smoke could affect CASE data] -> Require the separate `generated_many_to_many_smoke` database and prohibit reset/use of `examen_sw1`.

## Migration Plan

1. Add and test the authoritative `v1 -> v2` migration registry and CAS persistence, retaining direct-N:M fixtures only as migration regressions.
2. Implement and test the atomic core command plus frontend, persistence, and realtime boundary support for new models.
3. Make relational-core consume only version-2 association entities, then remove the direct N:M runtime mapper path and direct JPA generator path.
4. Change generated fixtures/harnesses to materialized canonical input and run automated checks plus the mandatory browser-to-ZIP, isolated PostgreSQL, Swagger, and CRUD manual gate.
5. Rollback before release by reverting this change as a whole. A failed migration leaves the version-1 resource unchanged; no fallback direct N:M generation is permitted.
