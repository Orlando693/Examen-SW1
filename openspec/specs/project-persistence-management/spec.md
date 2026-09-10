# project-persistence-management Specification

## Purpose

Defines durable project lifecycle behavior so canonical UML documents and layouts can be managed, saved, reopened, and protected from stale writes without persisting UI or collaboration state.

## Requirements

### Requirement: Durable project aggregate persistence
The system SHALL persist each project as an authoritative aggregate with UUID identity, editable metadata, nullable owner reference, canonical document revision, timestamps, a monotonic storage version, a document format version, canonical UML model data, and diagram layout data.

#### Scenario: Persist canonical model and layout separately from UI state
- **WHEN** a project is created or saved
- **THEN** its semantic UML model and logical diagram layout are stored without React Flow nodes or edges, viewport, zoom, pan, selection, active tool, drawer state, diagnostics, relationship draft, Undo/Redo history, layout-engine intermediates, presence, or realtime state

#### Scenario: Reopen a persisted project without loss
- **WHEN** a project containing supported UML data and layout positions is saved, closed, and reopened
- **THEN** the returned canonical document preserves its metadata, identifiers, local revision, semantic data, and layout data equivalently

#### Scenario: Start persistence versioning
- **WHEN** a project is created
- **THEN** it has `storageVersion` 0 and `documentSchemaVersion` 1 while its canonical document revision follows the existing project-document creation contract

### Requirement: Persisted format and concurrency versions are distinct
The system SHALL expose `documentSchemaVersion` for persisted-format compatibility and `storageVersion` for monotonic persistence concurrency, and SHALL keep both distinct from `ProjectDocument.revision`.

#### Scenario: Explain version roles in a project response
- **WHEN** a client receives a persisted project
- **THEN** it can obtain a document format version and storage version separately from the canonical document revision

#### Scenario: Reject unsupported document format
- **WHEN** a persisted project row or applicable persistence envelope uses an unsupported `documentSchemaVersion`
- **THEN** the system rejects it with `UNSUPPORTED_DOCUMENT_SCHEMA_VERSION` without treating it as a stale-write conflict

### Requirement: Normative project resource representations
The system SHALL represent full persisted projects as `ProjectResource` containing `{ project: ProjectDocument, storageVersion: number, documentSchemaVersion: number }` and project lists as `{ items: ProjectSummary[] }`, where each summary contains `id`, `name`, nullable `description`, `storageVersion`, `createdAt`, and `updatedAt` only.

#### Scenario: Return a full project resource
- **WHEN** a project is created, retrieved, saved, or metadata-updated
- **THEN** the response uses `ProjectResource` so the canonical document is unambiguous and persistence-envelope versions remain outside it

#### Scenario: Return project summaries
- **WHEN** projects are listed
- **THEN** the response returns `{ items: ProjectSummary[] }` without canonical model/layout, owner ID, canonical revision, or document schema version

### Requirement: Project lifecycle API
The system SHALL provide project creation, listing, retrieval, document save, metadata update, and hard deletion through the application API.

#### Scenario: Create an empty canonical project
- **WHEN** a valid project name and optional description are submitted for creation
- **THEN** the system accepts only `{ name, description? }`, creates an empty canonical document with server-owned identity/timestamps/owner, `storageVersion` 0, and `documentSchemaVersion` 1, and returns `ProjectResource`

#### Scenario: List projects before authentication exists
- **WHEN** projects are listed during CU-03
- **THEN** the system returns project-management metadata for existing projects without identity-based authorization filtering

#### Scenario: Retrieve an authoritative project
- **WHEN** a valid project identifier is requested
- **THEN** the system returns its complete authoritative `ProjectResource`

#### Scenario: Update project metadata
- **WHEN** a partial metadata request includes `baseStorageVersion` and at least one of optional `name` or nullable `description`
- **THEN** omitted fields remain unchanged, a present null description clears the description, and the system returns the authoritative updated `ProjectResource`

#### Scenario: Delete a confirmed project
- **WHEN** a project deletion is confirmed by the management UI and the API receives a valid required `baseStorageVersion` query parameter
- **THEN** the project is hard deleted only when its authoritative storage version matches and the API returns no content

### Requirement: Optimistic storage concurrency
The system SHALL save document changes, metadata changes, and hard deletion through an atomic compare-and-swap using client-supplied `baseStorageVersion`, not `ProjectDocument.revision`.

#### Scenario: Save against current storage version
- **WHEN** a document save supplies the current `baseStorageVersion`
- **THEN** the system atomically persists the submitted model and layout and increments `storageVersion` exactly once

#### Scenario: Submit document save content
- **WHEN** a document save is submitted
- **THEN** it accepts only `{ baseStorageVersion, document: { revision, model, layout } }`, reconstructs all other project-document fields from the authoritative database row, and returns `ProjectResource` on success

#### Scenario: Reject a stale mutation
- **WHEN** a document save, metadata update, or delete supplies a `baseStorageVersion` different from the authoritative stored version
- **THEN** the system does not mutate the project and returns HTTP `409` with `PROJECT_REVISION_CONFLICT`

#### Scenario: Competing saves do not both succeed
- **WHEN** two saves use the same base storage version concurrently
- **THEN** exactly one save succeeds and the other receives the stale-write conflict response

#### Scenario: Reject a stale delete without deletion
- **WHEN** `DELETE /projects/:id?baseStorageVersion=N` targets an existing project whose authoritative storage version is not N
- **THEN** the API returns HTTP `409` with `PROJECT_REVISION_CONFLICT` and the project remains unchanged

### Requirement: Stable project API errors and input boundaries
The system SHALL validate request inputs and return operational failures in the stable envelope `{ error: { code, message, details } }` without exposing persistence internals.

#### Scenario: Reject invalid project request input
- **WHEN** a request has malformed JSON fields, invalid UUIDs, non-integer or negative storage versions, missing required delete version query parameter, unknown fields, or client-controlled server fields
- **THEN** the system rejects it with `INVALID_REQUEST`

#### Scenario: Report invalid UML document data
- **WHEN** a document is structurally decodable but has blocking canonical UML diagnostics
- **THEN** the system returns `DOCUMENT_VALIDATION_FAILED` with the structured diagnostics and does not persist the candidate

#### Scenario: Filter internal persistence errors
- **WHEN** a database or unexpected server failure occurs
- **THEN** the response uses `INTERNAL_ERROR` without Prisma codes, SQL, connection strings, or stack traces

#### Scenario: Handle corrupt stored data as an internal failure
- **WHEN** a stored model or layout value is structurally corrupt or incompatible during project retrieval
- **THEN** the system logs safe internal context, returns `INTERNAL_ERROR`, and does not present the corrupt value as valid project data

### Requirement: Project management interface
The system SHALL provide a project-management landing experience with list, create, open, rename, confirmed hard delete, loading, retryable error, and empty states.

#### Scenario: Show an empty project list
- **WHEN** no persisted projects exist
- **THEN** the landing page displays an empty state with an action to create a project

#### Scenario: Recover from project-list failure
- **WHEN** loading the project list fails
- **THEN** the landing page displays an operational error and a retry action

#### Scenario: Open a listed project
- **WHEN** the user selects Open for a listed project
- **THEN** the editor is opened for that project identifier rather than a temporary demo document

### Requirement: Manual save and conflict-safe editor session
The system SHALL use manual save for persisted editor sessions and SHALL preserve local work when saving fails or conflicts.

#### Scenario: Save editable project content
- **WHEN** the current model or layout differs from the last server-confirmed persistible snapshot and the user invokes Save
- **THEN** the editor submits the current persistible content with its stored base storage version

#### Scenario: Preserve local work on conflict
- **WHEN** Save returns `PROJECT_REVISION_CONFLICT`
- **THEN** the editor retains the current local document and history, enters a conflict state, and offers explicit confirmed reload rather than merging or force-overwriting

#### Scenario: Do not autosave
- **WHEN** a user makes a canonical model or layout edit without invoking Save
- **THEN** the editor marks the session dirty without automatically persisting the change

### Requirement: CU-03 persistence verification and documentation
The implementation SHALL document the actual CU-03 outcome and verify persistence behavior with automated, database integration, and browser evidence before closure.

#### Scenario: Verify persistence integration
- **WHEN** CU-03 checks are executed
- **THEN** they cover migration application, JSONB round-trip, stale document/metadata/delete compare-and-swap, project lifecycle API outcomes, and save/reopen preservation

#### Scenario: Verify project flow in a real browser
- **WHEN** CU-03 is prepared for acceptance
- **THEN** a real browser verifies create, open, UML edit, layout move, manual save, leave, reopen, and equivalent model/layout recovery
