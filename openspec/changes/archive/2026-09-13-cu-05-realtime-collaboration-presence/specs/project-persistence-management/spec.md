## MODIFIED Requirements

### Requirement: Manual save and conflict-safe editor session
The system SHALL preserve manual whole-document save and conflict-safe local work for non-realtime clients, while an active realtime collaboration session SHALL persist each accepted UML command before acknowledgement and SHALL NOT use a client snapshot Save as its normal editing flow.

#### Scenario: Save editable project content
- **WHEN** a non-realtime project's model or layout differs from the last server-confirmed persistible snapshot and the user invokes Save
- **THEN** the editor submits the current persistible content with its stored base storage version through the existing document-save contract

#### Scenario: Preserve local work on conflict
- **WHEN** a non-realtime Save returns `PROJECT_REVISION_CONFLICT`
- **THEN** the editor retains the current local document and history, enters a conflict state, and offers explicit confirmed reload rather than merging or force-overwriting

#### Scenario: Do not autosave
- **WHEN** a user makes a canonical model or layout edit in a non-realtime persisted session without invoking Save
- **THEN** the editor marks that session dirty without automatically persisting the change

#### Scenario: Persist a realtime command before acceptance
- **WHEN** an authorized realtime UML command is accepted
- **THEN** the command result is stored through authorization-aware persistence CAS before `APPLIED` acknowledgement or broadcast and no manual Save is required

#### Scenario: Do not submit connected client snapshots
- **WHEN** a realtime collaboration session is connected
- **THEN** the editor does not use `PUT /projects/:id/document` with its local project snapshot as its normal Save operation

#### Scenario: Keep the existing document-save endpoint
- **WHEN** compatibility, a non-realtime client, or controlled external flow needs whole-document save
- **THEN** `PUT /projects/:id/document` retains its request, authorization, validation, error, and storage-version CAS contract

## ADDED Requirements

### Requirement: Realtime command persistence version propagation
The persistence boundary SHALL increment `storageVersion` exactly once for each durably accepted realtime command and SHALL return the exact authoritative resource versions produced by that persistence operation.

#### Scenario: Persist one realtime command
- **WHEN** command execution and validation succeed against the authoritative project row
- **THEN** one authorization-aware CAS writes model, layout, canonical revision, and timestamp as applicable and increments `storageVersion` once

#### Scenario: Propagate the resulting storage version
- **WHEN** realtime persistence succeeds
- **THEN** acknowledgement and broadcast carry the resulting `storageVersion` so every connected client updates its persistence-session state

#### Scenario: Reject authorization lost during command persistence
- **WHEN** an editor loses project access before the realtime persistence CAS matches
- **THEN** no result is persisted or broadcast and the editor receives concealed access loss without the current storage version

### Requirement: Coordinate external project mutations with active collaboration
The system SHALL execute whole-document Save, metadata mutation, and project deletion through the same per-project coordinator used by realtime commands so a persistent version change cannot silently overwrite or desynchronize joined clients.

#### Scenario: Whole-document save races a realtime command
- **WHEN** an external authorized whole-document Save and realtime command compete using the same storage version
- **THEN** storage CAS permits at most one write and the loser receives its established stale or resynchronization outcome

#### Scenario: Accept whole-document replacement during an active session
- **WHEN** a valid external document Save succeeds while sockets are joined
- **THEN** the active session is replaced or invalidated and all remaining authorized clients are instructed to fetch the new authoritative snapshot before further mutations

#### Scenario: Project deletion invalidates collaboration
- **WHEN** an owner successfully deletes a project with active sockets
- **THEN** the collaboration session is closed, presence is cleared, and no socket receives or submits further project state

#### Scenario: Metadata changes only persistence version
- **WHEN** an owner changes project metadata during an active collaboration session
- **THEN** authorized clients receive a protected non-command metadata/resource update containing the resulting storage version without falsely incrementing realtime command ordering or canonical UML revision

#### Scenario: Whole-document save invalidates the epoch
- **WHEN** an external whole-document save succeeds during an active collaboration session
- **THEN** coordinator ordering invalidates the old session epoch, makes old commands `STALE_SESSION`, and requires joined clients to resynchronize or rejoin

#### Scenario: Delete removes active collaboration state
- **WHEN** an owner deletes a project through current authorization and storage CAS
- **THEN** the coordinator invalidates its epoch, removes sockets and presence, releases ephemeral session state, and no later command recreates the deleted project
