## 1. Increment 1 - Canonical recursive relations and migration

- [x] 1.1 Add persisted endpoint `roleName` contracts, structural decoding, and canonical validation; verify self `ASSOCIATION` is accepted, self `GENERALIZATION` is rejected, and recursive roles round-trip.
- [x] 1.2 Implement command/executor support for role-aware recursive associations through `UmlCommandBus`; verify create, update, delete, local undo, and redo preserve exactly one self relation.
- [x] 1.3 Add authoritative document-schema `v1 -> v2` migration registry and coordinator CAS persistence; verify non-N:M version-1 documents transition once with equivalent semantics.
- [x] 1.4 Implement deterministic normal legacy direct-N:M materialization to one entity, identifier-marked `id: number`, two relations, and layout; verify repeated migration is a no-op and save/reload has no duplicates.
- [x] 1.5 Implement deterministic legacy self-N:M migration only with relationship name and distinct valid roles; verify missing semantics fail closed with `LEGACY_MANY_TO_MANY_MIGRATION_FAILED` and leave version 1 unchanged.
- [x] 1.6 Extend realtime decoding, normalization, digesting, coordinator, and ingestion for endpoint roles and migrated resources; verify PostgreSQL/Socket.IO convergence, retry dedupe, and migration-before-join.

## 2. Increment 2 - Editor and atomic association entities

- [x] 2.1 Route normal `*/*` creation and multiplicity edits through one atomic materialization command; verify `AlumnoMateria` appears exactly once with stable IDs, collision-safe naming, two edges, and no direct N:M.
- [x] 2.2 Route valid self `*/*` through atomic materialization; require non-empty relationship name and distinct non-empty roles, and verify `PersonaAmistad` has exactly two role-distinguished relations to `Persona`.
- [x] 2.3 Reject invalid self-N:M name/role combinations before mutation; verify no partial class, attribute, relationship, or layout is created.
- [x] 2.4 Implement self-loop adapter/projection and role editing in the workspace; verify rendering, labels, selection, edit, deletion, reload, and no renderer-side semantic mutation.
- [x] 2.5 Preserve recursive and materialized documents through persistence, local history, and realtime; verify save/reload, undo/redo, stale retry/resync, and no duplicate entity after rerender or broadcast.
- [x] 2.6 Define deletion and post-materialization behavior; verify class/endpoint deletion leaves no dangling references, replacement-edge deletion never restores direct N:M, and no silent dematerialization occurs.

## 3. Increment 3 - Relational, Spring ZIP, and acceptance

- [x] 3.1 Map role-aware recursive 1:N to one table with a role-derived self FK; verify `Empleado.jefe_id -> empleado.id`, no join table, determinism, and relational package checks.
- [x] 3.2 Map normal association entities as three ordinary tables and recursive association entities with two distinct same-table FKs; verify `persona_origen_id` and `persona_destino_id` both target `persona`.
- [x] 3.3 Remove production relational `JOIN`/`MANY_TO_MANY` paths and Spring `@ManyToMany`/`@JoinTable` templates after retaining migration-only fixtures; verify generated source contains neither retired annotation.
- [x] 3.4 Generate ordinary entity, repository, service, controller, DTO, mapper, validation, and supported CRUD layers for `Empleado`, `AlumnoMateria`, and `PersonaAmistad`; verify self JPA mappings and two distinct `@JoinColumn` names compile.
- [x] 3.5 Extend persisted-project generation and ZIP harnesses for all three scenarios; extract outside the repository and verify Java 21 `gradlew.bat --no-daemon test` and `gradlew.bat --no-daemon build` pass.
- [ ] 3.6 Execute the manual frontend-to-ZIP gate: create recursive 1:N, normal N:M, and self N:M diagrams, save/reload, verify no duplicates, generate ZIPs, and record evidence in CU-06 corrective documentation.
- [ ] 3.7 Execute the isolated PostgreSQL generated-backend gate: boot each ZIP, verify Swagger and Postman create/read/update-if-supported/delete for jefe/subordinado, Alumno/Materia/AlumnoMateria, and Persona/PersonaAmistad; inspect tables and FKs and record results.
- [ ] 3.8 Run focused and root automated checks, strict change/main-spec validation, and `git diff --check`; update only corrective CU-06 documentation when implementation state warrants it and do not edit CU-09, CU-10, STATUS/HANDOFF, archives, or unrelated files.
