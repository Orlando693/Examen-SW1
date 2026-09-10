## 1. INCREMENT 1 — Persistence Foundation

**Boundary:** Establish the framework-independent document boundary and durable PostgreSQL foundation. This increment does not add the project lifecycle API, project-management UI, editor Save UI, dirty/conflict UI, or browser acceptance.

- [x] 1.1 Add Prisma, PostgreSQL, `@examen-sw1/uml-core`, and DTO-validation dependencies plus reproducible Prisma scripts without changing the decided NestJS/Fastify architecture; verify workspace dependency resolution.
- [x] 1.2 Add root `compose.yaml` with a minimal PostgreSQL service for local development/testing and document that `DATABASE_URL` remains the application's sole connection selector.
- [x] 1.3 Add `DATABASE_URL` to `.env.example` and document local/external PostgreSQL setup without committing credentials.
- [x] 1.4 Add framework-independent `uml-core` structural decoding from `unknown` for the complete `ProjectDocument` shape, including nested UML variants and diagram layout; verify malformed data fails without treating TypeScript casts as validation.
- [x] 1.5 Add framework-independent `ProjectResource` persistence-envelope decoding with `documentSchemaVersion` 1 support and explicit unsupported-format results; verify `storageVersion` remains outside `ProjectDocument` and `UmlHistory`.
- [x] 1.6 Preserve `validateProjectDocument()` as the sole semantic UML validator after structural decoding; verify warnings remain non-blocking and blocking diagnostics reject persistence candidates.
- [x] 1.7 Add UML-core tests for malformed data, unsupported format, supported UML variants, metadata/revision/timestamps, layout, structural decode, semantic warnings/errors, and framework-independent round trips.
- [x] 1.8 Define `backend/prisma/schema.prisma` with authoritative relational project columns and JSONB model/layout, including canonical revision, `storageVersion` initialized to 0, and `documentSchemaVersion` initialized to 1.
- [x] 1.9 Create and inspect the initial Prisma migration; verify it creates required project JSONB/version/timestamp columns without destructive existing-data operations.
- [x] 1.10 Add reusable Prisma module/service and the persistence mapper that converts one authoritative row to `ProjectResource`/`ProjectDocument` and builds a row candidate without duplicating metadata, timestamps, owner, or revision inside JSONB.
- [x] 1.11 Establish an isolated reproducible PostgreSQL integration-test database, migration application, cleanup, and test isolation strategy without requiring project lifecycle HTTP endpoints.
- [x] 1.12 Add PostgreSQL persistence integration tests proving canonical model/layout JSONB round-trip, structural decode after reload, semantic equivalence, canonical revision/timestamps preservation, `storageVersion` 0 preservation, and `documentSchemaVersion` 1 preservation.
- [x] 1.13 Run Increment 1 relevant UML-core/backend/integration test, typecheck, lint, and build checks; record exact results and resolve foundation regressions.

**Increment 1 Definition of Done:** Structural decoding and semantic validation are tested; Prisma/PostgreSQL and its initial migration apply to an isolated database; the authoritative mapper exists; a canonical project persists and reloads with equivalent model/layout, revision, timestamps, `storageVersion`, and `documentSchemaVersion`; relevant checks pass. No project lifecycle API, management UI, Save UI, dirty/conflict UI, or browser evidence is required to close this increment.

## 2. INCREMENT 2 — Project API + Concurrency

**Boundary:** Deliver the complete REST lifecycle against PostgreSQL with explicit resource/DTO contracts and safe storage-version CAS. This increment does not add project-management UI, editor session loading, manual Save UI, dirty/conflict UI, or browser acceptance.

- [x] 2.1 Add a focused projects module/service/repository boundary using the Increment 1 Prisma mapper; controllers remain transport adapters.
- [x] 2.2 Define and validate `ProjectResource`, `ProjectSummary`, create, document-save, partial metadata-patch, and delete query contracts exactly as specified; reject unknown/server-owned fields and require at least one editable PATCH field.
- [x] 2.3 Configure NestJS/Fastify request-size protection, DTO transformation/whitelisting, UUID validation, and integer `baseStorageVersion >= 0` validation for write requests and Delete query parameters.
- [x] 2.4 Implement `POST /projects` to accept only create metadata and return `ProjectResource` for an empty canonical project with server-owned fields, `ownerId: null`, `storageVersion: 0`, and `documentSchemaVersion: 1`.
- [x] 2.5 Implement `GET /projects` as `{ items: ProjectSummary[] }` and `GET /projects/:id` as `ProjectResource`; verify temporary CU-03 pre-auth unfiltered listing and `404 PROJECT_NOT_FOUND`.
- [x] 2.6 Implement `PUT /projects/:id/document` using `SaveProjectDocumentRequest`: reconstruct server-owned document fields from the row, structurally decode, semantically validate, and atomically save submitted revision/model/layout with `baseStorageVersion`.
- [x] 2.7 Implement partial `PATCH /projects/:id` with `baseStorageVersion`, optional valid name, nullable description semantics, and atomic metadata CAS returning `ProjectResource`.
- [x] 2.8 Implement `DELETE /projects/:id?baseStorageVersion=<integer>` as confirmed hard delete with atomic ID/version matching; return `204` on match, `404` when absent, and `409 PROJECT_REVISION_CONFLICT` when stale.
- [x] 2.9 Add a stable error boundary using `{ error: { code, message, details } }`; cover malformed client input as `400 INVALID_REQUEST`, blocking UML diagnostics as `422 DOCUMENT_VALIDATION_FAILED`, unsupported format as `422 UNSUPPORTED_DOCUMENT_SCHEMA_VERSION`, corrupt stored JSONB as filtered `INTERNAL_ERROR`, and no leaked Prisma/SQL/stack details.
- [x] 2.10 Implement atomic compare-and-swap for document and metadata writes matching ID/storage version and incrementing storage version exactly once; distinguish absent row from stale row without read-then-write races.
- [x] 2.11 Add backend API/service tests for all lifecycle responses, exact resource/summary shapes, invalid UUID/query/body fields, payload limit, create/save/patch/delete, warning acceptance, blocking validation, and filtered errors.
- [x] 2.12 Add PostgreSQL integration tests for competing document saves and metadata writes using the same base version, proving exactly one success and stale non-mutation.
- [x] 2.13 Add PostgreSQL stale-delete integration evidence: delete with current version returns `204`; delete missing project returns `404`; delete with N-1 returns `409`, leaves the version-N project intact, and proves conditional deletion is atomic.
- [x] 2.14 Run Increment 2 backend/integration and relevant root checks; record exact results and resolve REST/concurrency regressions.

**Increment 2 Definition of Done:** The REST lifecycle works against PostgreSQL with normative request/resource shapes. Document, metadata, and delete mutations use atomic `storageVersion` CAS; concurrent/stale document, metadata, and deletion behavior is proven safe by real PostgreSQL integration tests. No frontend management/editor UI or browser acceptance is required to close this increment.

## 3. INCREMENT 3 — Project UI + Editor Integration

**Boundary:** Connect the existing Next.js editor and a minimal Material project-management flow to the completed API. This increment excludes final browser acceptance, OpenSpec verification, archive, commit, and push.

- [x] 3.1 Add a small typed fetch-based frontend project API client that treats API data as unknown, applies shared decoding, and maps the stable error envelope without adding a data-fetching dependency.
- [x] 3.2 Replace the root health-only placeholder with a scrollable Material project-management landing containing list, New Project, Open, Rename, confirmed version-aware Delete, loading, retryable error, and empty states.
- [x] 3.3 Retain `/editor` and load persisted projects through `/editor?projectId=<uuid>`; make bare `/editor` redirect to project selection or present an explicit selection state instead of silently loading demo data.
- [x] 3.4 Add atomic editor-session replacement that creates a fresh `UmlHistory`, sets decoded document/diagnostics, clears selection/transient UI and operational errors, resets counts, records `storageVersion` and `savedPersistentSnapshot`, and marks clean.
- [x] 3.5 Replace sequential IDs in real editor creation actions with UUID-based canonical IDs; verify class, enum, attribute, literal, and relationship creation after reload cannot collide with prior sessions.
- [x] 3.6 Add persistible snapshot comparison and `idle`/`dirty`/`saving`/`saved`/`error`/`conflict` semantics based only on editable metadata, model, and layout; verify Undo to saved content becomes clean.
- [x] 3.7 Add manual Save behavior using `SaveProjectDocumentRequest`; preserve Undo/Redo after success, update session storage version/server metadata/saved snapshot, and never autosave.
- [x] 3.8 Preserve local document/history after validation, network, or `409 PROJECT_REVISION_CONFLICT`; provide explicit confirmed authoritative reload without merge or force overwrite.
- [x] 3.9 Guard project-switch and asynchronous load/save/auto-layout work so a late result cannot mutate another project session; include project identity in relevant canvas reset/refit behavior.
- [x] 3.10 Add frontend tests for list loading/error/empty, create/open/rename/version-aware delete, bare editor behavior, fresh history per project, UUID creation after reload, dirty transitions, save success/failure, stale conflict, and confirmed reload.
- [x] 3.11 Run Increment 3 frontend and relevant root checks; record exact results and resolve UI/editor regressions.

**Increment 3 Definition of Done:** The frontend manages projects and edits a persisted project through the API. Each opened project creates a fresh history, manual save and dirty/conflict states are correct, local work survives failures, and persistent element IDs are durable. Final real-browser acceptance remains pending.

## 4. FINAL VERIFICATION

- [x] 4.1 Run complete UML-core, backend, frontend, integration, and root test/typecheck/lint/build checks; record exact passed/failed results and resolve CU-03 regressions.
- [x] 4.2 Decide during apply whether existing tooling can run an automated Playwright flow without installing Playwright; if automation is not added, record why and keep real-browser acceptance mandatory.
- [x] 4.3 Perform real-browser acceptance using `webapp-e2e-testing`: create project, open, create/edit UML, move layout, manually save, leave, reopen, and verify equivalent model/layout with no console or interaction regressions. Unit tests and HTTP success do not complete this task.
- [x] 4.4 Update `docs/puds/use-cases/CU-03-project-persistence-management.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` with actual implementation, migration/configuration, checks, browser evidence, limitations, and debt; do not claim unexecuted work.
- [x] 4.5 Run OpenSpec verification, resolve blockers, obtain user acceptance, and only then archive, commit, and push in the separate closure phase.
