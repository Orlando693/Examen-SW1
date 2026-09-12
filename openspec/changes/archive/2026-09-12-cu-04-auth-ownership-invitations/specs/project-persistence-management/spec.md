## MODIFIED Requirements

### Requirement: Project lifecycle API
The system SHALL provide authenticated project creation, authorized listing and retrieval, authorized document save, owner-only metadata update, and owner-only hard deletion through the application API.

#### Scenario: Create an empty canonical project
- **WHEN** an authenticated user submits a valid project name and optional description for creation
- **THEN** the system accepts only `{ name, description? }`, creates an empty canonical document with server-owned identity/timestamps/owner, `storageVersion` 0, and `documentSchemaVersion` 1, and returns `ProjectResource`

#### Scenario: List projects before authentication exists
- **WHEN** an authenticated user lists projects
- **THEN** the system returns project-management metadata only for projects owned by or assigned to that user without model/layout, owner ID, canonical revision, or document schema version

#### Scenario: Retrieve an authoritative project
- **WHEN** an owner or assigned editor requests a valid project identifier
- **THEN** the system returns its complete authoritative `ProjectResource`

#### Scenario: Conceal unrelated project retrieval
- **WHEN** an authenticated unrelated user requests a valid project identifier
- **THEN** the system returns `PROJECT_NOT_FOUND` without disclosing project existence

#### Scenario: Update project metadata
- **WHEN** the project owner submits a partial metadata request including `baseStorageVersion` and at least one optional `name` or nullable `description`
- **THEN** omitted fields remain unchanged, a present null description clears the description, and the system returns the authoritative updated `ProjectResource`

#### Scenario: Reject editor metadata administration
- **WHEN** an assigned editor submits a metadata update for a project they can edit
- **THEN** the system returns HTTP 403 `FORBIDDEN` and does not mutate the project

#### Scenario: Delete a confirmed project
- **WHEN** the project owner confirms deletion in the management UI and the API receives a valid required `baseStorageVersion` query parameter
- **THEN** the project is hard deleted only when its authoritative storage version matches and the API returns no content

#### Scenario: Reject editor deletion
- **WHEN** an assigned editor submits a delete request for a project they can edit
- **THEN** the system returns HTTP 403 `FORBIDDEN` and does not delete the project

### Requirement: Optimistic storage concurrency
The system SHALL save authorized document changes, owner metadata changes, and owner hard deletion through an atomic compare-and-swap using client-supplied `baseStorageVersion`, not `ProjectDocument.revision`.

#### Scenario: Save against current storage version
- **WHEN** an owner or assigned editor saves a document with the current `baseStorageVersion` and current authorization
- **THEN** the system atomically persists the submitted model and layout and increments `storageVersion` exactly once

#### Scenario: Submit document save content
- **WHEN** an authorized document save is submitted
- **THEN** it accepts only `{ baseStorageVersion, document: { revision, model, layout } }`, reconstructs all other project-document fields from the authoritative database row, and returns `ProjectResource` on success

#### Scenario: Reject a stale mutation
- **WHEN** an authorized document save, owner metadata update, or owner delete supplies a `baseStorageVersion` different from the authoritative stored version
- **THEN** the system does not mutate the project and returns HTTP `409` with `PROJECT_REVISION_CONFLICT`

#### Scenario: Reject authorization lost during save
- **WHEN** an editor loses membership before an attempted document save can atomically match authorization and storage version
- **THEN** the system does not mutate the project and returns `PROJECT_NOT_FOUND` without disclosing the current storage version

#### Scenario: Competing saves do not both succeed
- **WHEN** two authorized saves use the same base storage version concurrently
- **THEN** exactly one save succeeds and the other receives the stale-write conflict response

#### Scenario: Reject a stale delete without deletion
- **WHEN** `DELETE /projects/:id?baseStorageVersion=N` targets a project owned by the requester whose authoritative storage version is not `N`
- **THEN** the API returns HTTP `409` with `PROJECT_REVISION_CONFLICT` and the project remains unchanged
