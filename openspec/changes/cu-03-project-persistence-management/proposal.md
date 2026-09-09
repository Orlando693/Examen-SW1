## Why

CU-02 provides a command-driven UML editor only in browser memory, so a model is lost when the session ends and cannot be managed as a project. CU-03 introduces the first durable project lifecycle while preserving the canonical UML document and preparing the authoritative persistence boundary required before authentication and realtime collaboration.

## What Changes

- Add PostgreSQL and Prisma persistence with an initial migration, a reproducible development/test PostgreSQL Compose service, and `DATABASE_URL` configuration.
- Persist each project as a relational envelope (`id`, metadata, nullable `ownerId`, canonical document revision, timestamps, `storageVersion`, and `documentSchemaVersion`) plus separate JSONB `model` and `layout` values.
- Add runtime structural decoding for unknown project-document data in `uml-core`, followed by the existing `validateProjectDocument()` semantic validation; no second UML validator is introduced.
- Define three distinct version concepts: `ProjectDocument.revision` for canonical local UML evolution, `storageVersion` for monotonic persistence compare-and-swap, and `documentSchemaVersion` for persisted-format compatibility.
- Add the NestJS/Fastify project API for create, list, get, save document, rename/update metadata, and confirmed hard delete, with normative resource/payload contracts, stable filtered operational errors, and storage-version CAS for every mutation including delete.
- Replace the production editor demo startup with project selection and loading through `/editor?projectId=<uuid>`, manual save, dirty state, safe conflict handling, and fresh editor sessions per project.
- Preserve local Undo/Redo after save by keeping `storageVersion` outside `UmlHistory` and `ProjectDocument.revision`; do not persist history or React Flow state.
- Replace sequential editor-generated domain IDs with durable UUIDs for persisted UML elements.

## Capabilities

### New Capabilities
- `project-persistence-management`: PostgreSQL/Prisma project persistence, lifecycle API, optimistic storage concurrency, project-management UI, and persistent editor sessions.

### Modified Capabilities
- `canonical-uml-core`: add framework-independent structural decoding and persisted-document format compatibility while retaining one semantic UML validator.
- `manual-uml-workspace`: replace the pre-persistence demo startup requirement with persisted project sessions, manual save, dirty state, and conflict-safe editor behavior.

## Impact

- Adds planned Prisma/PostgreSQL dependencies, `backend/prisma/`, migration artifacts, `compose.yaml`, and `DATABASE_URL` during apply only.
- Adds backend Prisma and projects modules, DTO/error handling, and a dependency on `@examen-sw1/uml-core`.
- Changes the frontend landing into project management and evolves the existing `/editor` App Router route without creating a parallel app tree.
- Extends `uml-core` decoding and ID-generation contracts while retaining `CanonicalUmlModel` and `DiagramLayout` as the persisted domain boundary.
- Does not add authentication, authorization, invitations, Socket.IO, presence, autosave, merge, or generated-application capabilities.
