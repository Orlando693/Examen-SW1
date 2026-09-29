## Why

CU-06 currently rejects every self association and represents direct many-to-many relations with hidden relational joins and generated JPA `@ManyToMany`/`@JoinTable`. This leaves recursive domain semantics and association entities absent from the persisted canonical model and from the generated application.

This corrective change establishes explicit, role-aware canonical relations for the definitive examination scope: recursive associations, normal and recursive N:M materialization, relational mapping, Spring ZIP generation, and acceptance evidence.

## What Changes

- Permit `ASSOCIATION` relationships whose source and target are the same class; retain the prohibition on self-generalization.
- Persist an optional `roleName` on each association endpoint, validate distinguishable recursive endpoints where required, and preserve roles through editor, persistence, realtime, relational mapping, and generation.
- Render a persisted recursive association as a React Flow self-loop without renderer-side semantic mutation.
- Map recursive 1:N directly to one entity table with a self-referential FK, never a join table.
- Atomically replace every direct normal N:M association with one visible canonical association entity, its identifier-marked `id: number`, and two ordinary replacement associations; no direct N:M remains in `CanonicalUmlModel`.
- Require a non-empty `relationshipName` and distinct non-empty endpoint roles for self N:M; materialize `Persona * <-> * Persona` as a named association entity such as `PersonaAmistad` with two distinct references such as `personaOrigen` and `personaDestino`.
- Migrate supported persisted version-1 direct N:M documents deterministically to document schema version 2. Fail closed with `LEGACY_MANY_TO_MANY_MIGRATION_FAILED` when recursive legacy semantics or roles cannot be determined safely.
- Remove production direct N:M relational and Spring rendering paths, including `@ManyToMany`, `@JoinTable`, and hidden join-table contracts, after legacy migration coverage exists. **BREAKING** for internal relational and generated-source consumers that expect those retired contracts.
- Prove the generated Spring ZIP from persisted models with Java 21 Gradle tests/build, isolated PostgreSQL tables and FKs, Swagger, and Postman CRUD acceptance for recursive 1:N, normal N:M, and recursive N:M.
- Do not modify archived CU-06 artifacts, the active CU-09 change, CU-10, voice, Flutter, XMI, or unrelated workspace files.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `canonical-uml-core`: role-aware recursive associations and atomic normal/self N:M association-entity materialization replace direct canonical N:M relations.
- `manual-uml-workspace`: recursive relationships render as self-loops and materialized association entities render solely from the canonical document.
- `project-persistence-management`: versioned, idempotent and fail-closed migration plus round-trip persistence cover role-aware recursive and materialized relation documents.
- `realtime-collaboration`: authoritative normalization, deduplication, persistence and convergence cover recursive relation commands and materialization.
- `uml-relational-mapping`: recursive 1:N maps to a self FK and association entities map to ordinary tables with distinct FK columns, replacing direct N:M join mapping.
- `spring-backend-generation`: generated Spring entities use ordinary JPA FK mappings and CRUD for association entities, never direct N:M annotations.

## Impact

- `packages/uml-core`: relationship endpoint contract, validation, document migration, commands, executor, history, and tests.
- `frontend`: relationship adapter/form, self-loop projection, inspector, and editor tests.
- `backend`: project decode/migration, generation boundary, realtime decoder/normalizer/coordinator, and integration tests.
- `packages/relational-core` and `packages/spring-generator`: relation contracts, mapper/generator/templates, fixtures, ZIP harness, and generated-project tests.
- Generated Spring backend, OpenAPI-derived Postman acceptance, and isolated PostgreSQL smoke evidence; no new dependency is expected.
