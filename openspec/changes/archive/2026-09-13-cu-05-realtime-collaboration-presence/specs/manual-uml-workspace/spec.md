## MODIFIED Requirements

### Requirement: Canvas interactions and layout updates
The workspace SHALL support standard canvas interactions, keep committed node positions in `DiagramLayout`, and route connected layout intentions through authoritative realtime commands without allowing projection callbacks to emit remote changes again.

#### Scenario: Use canvas navigation
- **WHEN** the user interacts with the canvas
- **THEN** zoom, pan, selection, drag or move, and fit-to-content behavior are available without treating viewport state as persisted layout

#### Scenario: Move node updates layout only
- **WHEN** the user commits a UML node move
- **THEN** semantic UML data remains unchanged and the move uses the command route, sending one non-optimistic realtime intention when collaboration is connected

#### Scenario: Preserve viewport for authoritative state
- **WHEN** an authoritative command, layout result, resync snapshot, or presence update changes workspace state
- **THEN** it does not automatically fit or recenter the viewport; only initial authoritative join and explicit Fit View may fit

#### Scenario: Auto-layout changes positions
- **WHEN** a connected user runs auto-layout
- **THEN** the originating client calculates one `ApplyLayout` intention, the server validates and persists its logical positions, and receiving clients do not rerun the layout engine

#### Scenario: Auto-layout is one history operation
- **WHEN** auto-layout runs in a non-collaborative local session and the user invokes undo once
- **THEN** all positions changed by that auto-layout operation are restored together

### Requirement: Persisted editor save state
The workspace SHALL use last-server-confirmed snapshot dirty semantics for non-realtime persisted sessions and SHALL use authoritative pending, saving, saved, disconnected, resynchronizing, and error states for an active realtime session.

#### Scenario: Mark an unsaved canonical edit dirty
- **WHEN** a non-realtime accepted UML command changes model or layout away from the last saved persistible snapshot
- **THEN** the workspace marks that session dirty without treating transient UI changes as persisted changes

#### Scenario: Undo to the saved snapshot
- **WHEN** undo in a non-realtime session returns model, layout, and editable metadata to the last server-confirmed persistible snapshot
- **THEN** the workspace marks the session clean

#### Scenario: Preserve Undo and Redo after save
- **WHEN** manual save succeeds outside an active realtime collaboration session
- **THEN** the workspace retains local `UmlHistory`, updates persistence-session values and saved snapshot, and keeps local Undo/Redo available

#### Scenario: Retain local work after save failure
- **WHEN** a non-realtime manual save fails due to validation, network, or stale conflict
- **THEN** the workspace retains the current document and local Undo/Redo history and remains dirty

#### Scenario: Show a pending realtime intention
- **WHEN** a connected user submits an editing intention that has not received an authoritative result
- **THEN** the workspace shows pending or saving state without changing its canonical document

#### Scenario: Show accepted realtime state as saved
- **WHEN** the server returns an authoritative applied command after persistence
- **THEN** the workspace applies it once, updates its versions, and shows shared state as saved without requiring manual Save

#### Scenario: Show disconnected or resynchronizing state
- **WHEN** realtime connectivity is lost or an authoritative replacement is required
- **THEN** the workspace shows the corresponding state and blocks canonical mutations until join or resynchronization completes

### Requirement: Undo and redo from workspace
The workspace SHALL expose local undo and redo through shared UML history outside active realtime collaboration and SHALL disable snapshot-based Undo/Redo while collaboration is active.

#### Scenario: Undo command from UI
- **WHEN** a non-collaborative user invokes undo after an accepted local edit
- **THEN** the current project document returns to the previous state and the canvas updates from that document

#### Scenario: Redo command from UI
- **WHEN** a non-collaborative user invokes redo after undo
- **THEN** the current project document returns to the redone state and the canvas updates from that document

#### Scenario: Clear redo after new edit
- **WHEN** a non-collaborative user performs a new accepted edit after undo
- **THEN** redo is no longer available for the previously undone operation

#### Scenario: Disable Undo and Redo during collaboration
- **WHEN** a realtime collaboration session is active
- **THEN** Undo and Redo controls are disabled with a concise explanation that collaborative editing does not support snapshot history

#### Scenario: Preserve the history capability
- **WHEN** realtime collaboration ends and a supported non-collaborative session is used
- **THEN** the shared `UmlHistory` capability remains available rather than being removed from the system

## ADDED Requirements

### Requirement: Dedicated authoritative collaboration boundary
The workspace SHALL manage Socket.IO lifecycle outside `UmlCanvas`, obtain the access token from the existing auth session, and expose explicit authoritative session, command, snapshot, presence, and connection actions without duplicating authentication state in the editor store.

#### Scenario: Initialize collaboration after HTTP load
- **WHEN** an authenticated persisted project is loaded by HTTP
- **THEN** socket listeners are registered before join, mutations remain disabled, and the socket snapshot replaces the HTTP document before connected editing begins

#### Scenario: Change projects safely
- **WHEN** the editor selects another project
- **THEN** its collaboration controller leaves and cleans the previous session before initializing the target session

#### Scenario: Dispose collaboration lifecycle
- **WHEN** the editor unmounts, logs out, expires authentication, or leaves the project
- **THEN** listeners, socket subscriptions, pending state, and project-specific ephemeral UI state are cleaned without duplicate handlers

### Requirement: React Flow remains an idempotent projection during collaboration
The workspace SHALL apply authoritative commands and snapshots to `ProjectDocument` before projection and SHALL emit outbound UML commands only from explicit local intent handlers.

#### Scenario: Apply a remote semantic command
- **WHEN** an authoritative class, enumeration, attribute, or relationship command arrives
- **THEN** the canonical document changes through the authoritative store path and React Flow nodes or edges are rederived without invoking a local command handler

#### Scenario: Avoid generic state-driven publication
- **WHEN** Zustand document, projection, selection, measurement, diagnostics, or presence state changes
- **THEN** no outbound command is emitted merely because the store or React Flow props changed

#### Scenario: Preserve canvas stability
- **WHEN** local and remote collaboration events are processed repeatedly
- **THEN** stable node and edge types, guarded store writes, measurable canvas sizing, and controlled fit behavior prevent update-depth loops, React Flow error `#004`, duplicate keys, and projection feedback

### Requirement: Collaborative presence and persistence UX
The workspace SHALL show online collaborators, remote logical cursors, remote selections, edited-element/activity indicators, and shared persistence/connection status without obscuring the canvas or changing canonical state.

#### Scenario: Show deduplicated online users
- **WHEN** multiple authorized sockets join the project, including two tabs for one user
- **THEN** the UI shows one safe roster row per authorized participant with derived avatar, OWNER/EDITOR label, online/offline state, and available last activity

#### Scenario: Show remote canvas presence
- **WHEN** another collaborator publishes valid cursor, selection, editing, or activity state
- **THEN** the workspace renders a distinguishable user-associated indicator without replacing the receiving user's own selection

#### Scenario: Block edits during disconnection
- **WHEN** the status is disconnected, resynchronizing, expired, or access-revoked
- **THEN** canonical mutation controls are disabled and the UI explains the current recovery or authentication action

### Requirement: Collaboration lifecycle, history, and mutation gate
The workspace SHALL use one generation-owned collaboration controller, one in-flight durable command gate, and fresh empty history rebased to every authoritative document installation.

#### Scenario: Ignore stale asynchronous lifecycle work
- **WHEN** HTTP load, join, resync, timeout, socket event, or layout work completes for an obsolete controller generation
- **THEN** it does not replace the active project, session, history, buffer, or viewport state

#### Scenario: Block a second durable mutation
- **WHEN** one connected UML command is pending, saving, uncertain, joining, disconnected, or resynchronizing
- **THEN** every canonical model/layout mutation path is blocked while pan, zoom, inspection, and presence remain available

#### Scenario: Rebase history after authoritative installation
- **WHEN** join, own applied result, remote applied result, resync, or collaboration exit installs an authoritative document
- **THEN** `UmlHistory` is recreated from that document with empty undo/redo stacks and no old snapshot can later restore stale state

### Requirement: Realtime editor mode and Save status
The persisted web editor SHALL attempt realtime collaboration for editable projects and SHALL not silently fall back to local snapshot Save or offline durable edits when collaboration is unavailable.

#### Scenario: Show connected persistence status
- **WHEN** realtime collaboration is connected
- **THEN** the Save area is a non-action persistence status showing saving, saved, disconnected, resynchronizing, or error and never sends `PUT /projects/:id/document`

#### Scenario: Keep non-mutating interaction during outage
- **WHEN** realtime is disconnected or authentication is required
- **THEN** new canonical mutations remain blocked while safe viewport and inspection interactions remain usable
