## Why

CU-06 currently preserves a direct UML many-to-many association and derives a composite-key join table plus direct JPA `@ManyToMany`/`@JoinTable`. That leaves the visible canonical model different from the generated application and prevents a modeler from treating the link as a real, editable domain entity.

This corrective change makes a many-to-many intent materialize once, atomically, as an explicit association class in the canonical project document, so the editor, persistence, collaboration, relational model, and generated Spring backend share one semantic representation.

## What Changes

- Add an authoritative atomic UML command that replaces a newly created or updated many-to-many association with one normal association class and two supported replacement associations.
- Detect many-to-many exclusively from the existing endpoint multiplicity representation: both upper bounds represent many (`*`, including canonical ranges ending in `*`).
- Give the association class a stable authority-assigned UUID, deterministic collision-safe human-readable name, persisted identifier-marked `id: number` attribute that maps to SQL `BIGINT`/Java `Long`, and an initial layout position derived from the endpoint nodes.
- Preserve a materialized association class when later multiplicity edits would no longer be many-to-many; destructive dematerialization requires a future explicit operation.
- Project, persist, reload, synchronize, validate, and locally undo/redo the whole transformation as one logical document mutation.
- Migrate historical persisted direct N:M documents once and durably through the authoritative project boundary before they are edited, synchronized, mapped, or generated; fail closed with an actionable diagnostic when historical relationship metadata cannot be represented safely.
- Replace relational-core's direct N:M join-table representation and Spring's direct `@ManyToMany`/`@JoinTable` rendering with the ordinary three-entity/two-many-to-one representation. **BREAKING** for consumers of internal `JOIN`/`MANY_TO_MANY` relational contracts and generated source expectations.
- Extend the persisted-project Spring ZIP integration and generated-project harness to prove association-entity source, Gradle test/build, and the mandatory manual PostgreSQL/Swagger/CRUD smoke gate.
- Do not modify archived CU-06 changes, the active CU-09 change, or the CU-10 proposal.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `canonical-uml-core`: atomically materialize a semantic association class instead of retaining direct canonical N:M relations.
- `manual-uml-workspace`: show the resulting class and two relationships from the document projection without renderer-side semantic mutation.
- `project-persistence-management`: migrate and durably reload historical direct N:M documents exactly once as a versioned materialized document.
- `realtime-collaboration`: apply the authority-normalized atomic materialization command once through the existing durable command protocol.
- `uml-relational-mapping`: map the association class as an ordinary entity with a surrogate key and two foreign keys instead of an internal N:M join table.
- `spring-backend-generation`: generate normal association-entity CRUD and JPA many-to-one/one-to-many relationships, never direct `@ManyToMany`/`@JoinTable` for materialized N:M.

## Impact

- `packages/uml-core`: model contracts, versioned document migration, commands, executor, validation, decoder, and history tests.
- `frontend`: relationship creation/edit intent, document projection, layout placement, and editor tests.
- `backend`: persisted project decoding/integration and realtime command decoder, normalizer, coordinator, and integration tests.
- `packages/relational-core` and `packages/spring-generator`: contracts, mapper/generator/templates, fixtures, and generated Gradle harness.
- Existing project generation endpoint and generated Spring API behavior; no root dependency is expected.
