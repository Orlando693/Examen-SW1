## Context

CU-01 provides a framework-independent `ProjectDocument` with canonical model, layout, local `revision`, timestamps, validation, commands, and snapshot-based `UmlHistory`. CU-02 uses one in-memory history initialized from demo data. The backend remains a NestJS/Fastify health endpoint without persistence. See `proposal.md` for motivation and the delta specs for required behavior.

`ProjectDocument.revision` is changed by accepted UML commands and restored by Undo/Redo snapshots. It cannot serve as the monotonic compare-and-swap value for durable storage.

## Goals / Non-Goals

**Goals:**

- Persist a single canonical project aggregate without introducing a second UML source of truth.
- Make malformed API/database data fail at a runtime structural boundary before shared semantic validation.
- Provide atomic stale-write protection that preserves local history and work on failure.
- Keep the App Router and existing editor/canvas projection architecture intact.
- Establish a repository/service persistence boundary reusable by CU-05.

**Non-Goals:**

- Auth, authorization, ownership enforcement, memberships, invitations, Socket.IO, presence, command broadcast, CRDT, OT, command logs, or distributed Undo/Redo.
- Autosave, Save As, conflict merge, force overwrite, revision history, soft-delete restore, browser-local database synchronization, relational UML normalization, XMI, generation, AI, voice, Flutter, or AWS.

## Decisions

### 1. Separate Canonical Revision, Storage Version, And Format Version

Decision: retain `ProjectDocument.revision` as canonical/local UML evolution. Add `storageVersion` only to the persisted-project envelope/session and use it exclusively as the monotonic persistence compare-and-swap token. Add `documentSchemaVersion` only to the persisted envelope/API contract, beginning at `1`.

```text
ProjectDocument.revision
  Local canonical document evolution; changed by accepted UML commands and reversible by Undo/Redo.

Project.storageVersion
  Server-authoritative monotonic persistence version; starts at 0 and increments once only by an accepted non-delete storage mutation.

Project.documentSchemaVersion
  Persisted data-format compatibility identifier; used by decoders/migrations, not by concurrency or commands.
```

The API sends `baseStorageVersion`, never `baseRevision`, for document, metadata, and delete writes. `storageVersion` is not included in `ProjectDocument`, so Undo/Redo cannot change it. Create sets `storageVersion` to `0`; each accepted document or metadata write advances it from `N` to `N + 1`. Delete requires the current version but does not increment it because it removes the resource.

Alternative considered: use `ProjectDocument.revision` as the storage token. Rejected because commands increment it before save and Undo restores older snapshots, producing false stale checks and non-monotonic stored values. A second internal lock field plus `storageVersion` was rejected as redundant.

### 2. Project Aggregate Mapping And PostgreSQL Shape

Decision: persist project-envelope fields as relational columns and canonical content as two JSONB columns.

```text
Project
├── id: UUID
├── name: string
├── description: nullable string
├── ownerId: nullable UUID
├── revision: integer (the persisted ProjectDocument.revision)
├── storageVersion: integer
├── documentSchemaVersion: integer
├── createdAt: timestamp
├── updatedAt: timestamp
├── model: JSONB
└── layout: JSONB
```

The sole project persistence mapper reconstructs `ProjectDocument` from the row's authoritative `id`, metadata, nullable owner, persisted canonical `revision`, timestamps, `model`, and `layout`. It then wraps that document with row `storageVersion` and `documentSchemaVersion` as the API resource. The relational columns are the only stored source for name, description, owner, timestamps, and canonical revision; `model` and `layout` JSONB do not duplicate those values.

```ts
type ProjectResource = {
  project: ProjectDocument;
  storageVersion: number;
  documentSchemaVersion: number;
};

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  storageVersion: number;
  createdAt: string;
  updatedAt: string;
};
```

The API uses `ProjectResource` for create, get, document save, and metadata update. `GET /projects` returns `{ items: ProjectSummary[] }`; summaries deliberately omit model, layout, owner, canonical revision, and document schema version.

`ownerId` is nullable and server-owned during CU-03. Listing is temporarily unfiltered because CU-04 will introduce authenticated identity and authorization. No fake users or auth tables are created now.

JSONB is selected because CU-03 loads/saves the canonical model as an aggregate and has no requirement to query classes, attributes, or relationships relationally. One whole-document JSON column was rejected because it obscures list/rename/concurrency fields or duplicates them. Fully normalized UML tables were rejected as premature scope.

### 3. Runtime Decode Then Semantic Validation

Decision: add a framework-independent decoder in `uml-core` that accepts `unknown`, verifies the complete runtime structure needed by `ProjectDocument` and the versioned persistence envelope, and reports structured decode/format failures. Consumers then call the existing `validateProjectDocument()` unchanged for semantic UML invariants.

```text
unknown JSON
  -> structural decoder
  -> ProjectDocument
  -> validateProjectDocument()
  -> accepted candidate or structured diagnostics
```

Nest DTO validation protects transport fields, field allow-lists, UUIDs, non-negative `baseStorageVersion`, and payload shape. It reconstructs server-owned fields before the shared decoder/semantic validator. Frontend API code treats received JSON as `unknown` and uses the same decoder before initializing the editor.

Alternative considered: trust `JSON.parse(...) as ProjectDocument`. Rejected because a TypeScript cast is not runtime validation. A second backend-only UML validator was rejected because it would diverge from the required shared validation engine.

### 4. Atomic Project Writes And Error Contract

Decision: document save and metadata update use one database compare-and-swap operation equivalent to:

```text
WHERE id = :projectId
  AND storageVersion = :baseStorageVersion

SET ...,
    storageVersion = storageVersion + 1,
    updatedAt = current timestamp
```

If no row changes, the service distinguishes missing project from stale version and returns `404 PROJECT_NOT_FOUND` or `409 PROJECT_REVISION_CONFLICT`. The authoritative resource returned by successful writes contains the new storage version. Conflict keeps local work intact; reload requires explicit user confirmation and no force overwrite exists.

Hard delete uses `DELETE /projects/:id?baseStorageVersion=<non-negative integer>`. The required query parameter is validated as an integer greater than or equal to zero. It performs an atomic conditional delete matching both ID and storage version. A missing project returns `404 PROJECT_NOT_FOUND`; an existing project with a different version returns `409 PROJECT_REVISION_CONFLICT`; a match returns `204 No Content`. UI confirmation is required before this request but does not replace the compare-and-swap.

All project API failures use:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "details": {}
  }
}
```

Supported operational codes are `INVALID_REQUEST`, `PROJECT_NOT_FOUND`, `PROJECT_REVISION_CONFLICT`, `DOCUMENT_VALIDATION_FAILED`, `UNSUPPORTED_DOCUMENT_SCHEMA_VERSION`, `PAYLOAD_TOO_LARGE`, and `INTERNAL_ERROR`. Malformed client HTTP payloads produce `400 INVALID_REQUEST`; a structurally valid candidate with blocking semantic diagnostics produces `422 DOCUMENT_VALIDATION_FAILED`; and unsupported applicable document format produces `422 UNSUPPORTED_DOCUMENT_SCHEMA_VERSION`. A stored PostgreSQL row with corrupt or incompatible JSONB is an internal condition: log safe context, return generic `INTERNAL_ERROR`, and never present the corrupted value as a valid project. Prisma errors, SQL, connection details, stack traces, and stored JSON are not returned.

### 5. API And Backend Boundary

Decision: add a focused Prisma module and a projects module. The service/repository layer owns mapping, decoding, validation, compare-and-swap, and Prisma error translation; controllers remain transport adapters.

```text
AppModule
├── HealthController
├── PrismaModule
└── ProjectsModule
    ├── ProjectsController
    └── ProjectsService
```

The lifecycle API is:

```text
POST   /projects                 create empty canonical project
GET    /projects                 list management metadata
GET    /projects/:id             retrieve authoritative project
PUT    /projects/:id/document    save model/layout with baseStorageVersion
PATCH  /projects/:id             update name/description with baseStorageVersion
DELETE /projects/:id?baseStorageVersion=N  hard delete with CAS
```

Normative request and response shapes are:

```ts
type CreateProjectRequest = {
  name: string;
  description?: string | null;
};

type SaveProjectDocumentRequest = {
  baseStorageVersion: number;
  document: {
    revision: number;
    model: CanonicalUmlModel;
    layout: DiagramLayout;
  };
};

type UpdateProjectMetadataRequest = {
  baseStorageVersion: number;
  name?: string;
  description?: string | null;
};
```

Create accepts only the declared editable metadata and creates empty canonical model/layout, canonical revision from the existing document contract, `storageVersion: 0`, `documentSchemaVersion: 1`, server timestamps, and `ownerId: null`. Metadata PATCH must contain at least one editable field in addition to `baseStorageVersion`; an omitted field is unchanged and `description: null` clears its value. Save accepts no ID, owner, metadata, timestamps, storage version, or format version. The service reads the authoritative row, combines its ID/name/description/owner/created timestamp/current updated timestamp with submitted revision/model/layout, structurally decodes the candidate, semantically validates it, and only then performs CAS persistence. Unknown fields are rejected.

Request-body limits are configured at the HTTP boundary. Validation whitelist/rejection and a generic exception translation layer prevent unknown fields and internal database details from crossing the API boundary.

### 6. Database Provisioning And Testing Topology

Decision: add `backend/prisma/schema.prisma`, initial migration artifacts, `DATABASE_URL` documentation, and a minimal root `compose.yaml` PostgreSQL service during apply. Docker is only a reproducible local development/testing option; the application selects its database solely through `DATABASE_URL`, so an external PostgreSQL server remains supported.

Automated persistence integration tests use an isolated PostgreSQL database with migrations applied. Mocked Prisma tests may cover service branches but cannot replace migration, JSONB, timestamp, or competing compare-and-swap evidence.

### 7. Project Landing And Editor Routing

Decision: transform `/` into the minimal project-management landing and retain the existing `/editor` route with `?projectId=<uuid>`. This minimizes routing changes and preserves `frontend/app/`.

The bare `/editor` route redirects to the landing/project selection or presents an explicit select/create state; it never silently creates a demo project in production. The landing provides list, create, open, rename, confirmed hard delete, loading, retryable error, and empty states only. Search, pagination, filtering, authentication, and invitations are excluded.

Server route shells remain Server Components. Interactive list controls and the editor remain localized client boundaries. A small fetch-based project API client centralizes parsing and error handling; no new client-state/data-fetching library is required.

### 8. Editor Session, Dirty State, And Local History

Decision: opening a project performs one session replacement:

1. Fetch unknown project response.
2. Structurally decode it.
3. Run shared semantic validation.
4. Construct a new `UmlHistory` from the decoded document.
5. Atomically replace render snapshot and diagnostics.
6. Clear selection, active relationship draft, drawers as appropriate, command/save errors, and undo/redo counts.
7. Record server `storageVersion` and clone the last confirmed persistible snapshot.
8. Mark the session clean.

The persistible snapshot compares user-editable metadata, model, and layout only. It excludes viewport, zoom/pan, selection, active tool, drawers, diagnostics, relationship draft, and history. Dirty is derived from equivalence with the saved snapshot, not from `ProjectDocument.revision` or storage version. Undo back to saved content clears dirty; moving away marks dirty.

Successful manual save preserves the existing `UmlHistory`, updates the session `storageVersion`, server-owned metadata/timestamps returned by the API, and saved persistible snapshot, then marks clean. It does not add a history entry or rebase all history snapshots. Failed and stale saves preserve document, history, base storage version, and dirty state.

New UML element IDs use UUIDs supplied by the existing `uml-core` mechanism. Session-local IDs such as `class-1` are not acceptable after persisted reloads.

### 9. CU-04 And CU-05 Compatibility

CU-04 can add a user relation, ownership assignment, authorization filtering, memberships, and invitations around the nullable `ownerId` envelope field. CU-03 does not select how historical ownerless projects are claimed; that is an CU-04 migration decision.

CU-05 can reuse the service/repository compare-and-swap boundary and authoritative project retrieval for accepted realtime commands. It will add Socket.IO command transport, immediate persistence, broadcast, and presence separately. Presence remains outside the document and does not affect storage version.

## Risks / Trade-offs

- [Structural decoding expands `uml-core` tests] -> Keep it framework-free, separate structural checks from existing semantic rules, and cover malformed/unsupported data.
- [JSONB permits corrupt rows outside the API] -> Decode and semantically validate both before save and after load; return filtered operational errors for corrupt data.
- [A large project can exceed HTTP defaults] -> Configure a documented payload limit and test boundary failure without guessing unlimited size.
- [Async editor work can finish after project switch] -> Bind load/auto-layout/save completions to the current project/session identity and ignore stale completions.
- [Global editor overflow rules can clip a project list] -> Keep scrollable management content separate from the fixed editor viewport behavior.
- [Pre-auth listing exposes all local projects] -> Document this temporary CU-03 behavior and apply authorization filtering only in CU-04.

## Migration Plan

1. Add Prisma dependencies and configuration, `DATABASE_URL`, Compose PostgreSQL, schema, and initial migration.
2. Apply the migration to local/integration databases; no existing persisted project data requires backfill because CU-03 introduces first storage.
3. Deploy backend project API and frontend project-management/editor session support together so clients only save versioned envelopes.
4. On rollback before any production data exists, roll back the application and remove the initial schema only through an explicit environment-specific database operation; never delete a database implicitly from application startup.
5. Future format changes increment `documentSchemaVersion` and add an explicit decoder/migration path while retaining the ability to reject unsupported formats safely.
