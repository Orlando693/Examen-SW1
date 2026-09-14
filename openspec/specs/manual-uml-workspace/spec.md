# manual-uml-workspace Specification

## Purpose

Defines the manual UML editor workspace that lets users visually create, inspect, validate, lay out, and revise an in-memory `ProjectDocument` while preserving the canonical UML model as the source of truth.

## Requirements

### Requirement: Responsive UML workspace shell
The system SHALL provide a responsive UML editor workspace with clear regions for project navigation, breadcrumbs, editing actions, canvas, properties, diagnostics, status feedback, and persisted-project loading states.

#### Scenario: Use existing App Router layout
- **WHEN** the editor route is implemented
- **THEN** it uses the existing `frontend/app/editor/page.tsx` App Router structure without introducing a parallel app source tree

#### Scenario: Render desktop workspace
- **WHEN** the editor workspace is opened on a desktop viewport for a loaded project
- **THEN** the user can see a top application bar, navigation/sidebar area, breadcrumbs, toolbox, central UML canvas, inspector or properties panel, diagnostics area, and status bar

#### Scenario: Render compact workspace
- **WHEN** the editor workspace is opened on a reduced-width viewport for a loaded project
- **THEN** secondary panels are available through compact responsive controls while the canvas remains the primary interaction area

#### Scenario: Require a persisted project selection
- **WHEN** the editor route opens without a valid selected project
- **THEN** it does not silently load temporary demo data and instead redirects to project selection or displays a clear project-selection state

#### Scenario: Use demo document before persistence
- **WHEN** the editor opens in an environment where project persistence does not exist
- **THEN** it loads a clearly identified temporary in-memory project document for demonstration and editing

### Requirement: Canonical document projection to canvas
The workspace SHALL render visual nodes and relationship edges by projecting the current `ProjectDocument` semantic model together with its diagram layout.

#### Scenario: Project classes to nodes
- **WHEN** the current project document contains UML classes
- **THEN** the canvas shows class nodes derived from those classes and their corresponding layout entries when available

#### Scenario: Project enumerations to nodes
- **WHEN** the current project document contains UML enumerations
- **THEN** the canvas shows enumeration nodes derived from those enumerations and their corresponding layout entries when available

#### Scenario: Project relationships to edges
- **WHEN** the current project document contains associations, aggregations, compositions, or generalizations between classes
- **THEN** the canvas shows distinguishable relationship edges for each relationship kind

#### Scenario: Avoid canvas as source of truth
- **WHEN** the workspace recomputes its visual graph
- **THEN** the graph is derived from the current project document instead of becoming an independently persisted UML model

### Requirement: UML class and enumeration visualization
The workspace SHALL provide readable UML-oriented visual representations for classes and enumerations.

#### Scenario: Show class compartments
- **WHEN** a UML class is displayed
- **THEN** the node shows the class name, attributes, and operations when present using visually separated compartments

#### Scenario: Show enumeration literals
- **WHEN** a UML enumeration is displayed
- **THEN** the node shows the enumeration name and its literals

#### Scenario: Show selected element
- **WHEN** a node or relationship is selected
- **THEN** the workspace visually distinguishes the selection and exposes the selected element in the inspector

### Requirement: Manual UML editing through commands
The workspace SHALL translate supported user editing intents into UML commands and apply them through the shared command route instead of mutating the canonical model directly.

#### Scenario: Create class from UI
- **WHEN** the user creates a class from the workspace
- **THEN** a class is added to the project document through the command route and the canvas updates from the new document

#### Scenario: Rename class from inspector
- **WHEN** the user renames a selected class from the inspector
- **THEN** the class name changes through the command route and the canvas updates from the new document

#### Scenario: Delete class from UI
- **WHEN** the user deletes a selected class
- **THEN** the class and invalidated visual/layout references are removed through the command route

#### Scenario: Manage attributes from inspector
- **WHEN** the user adds, edits, or removes an attribute on a selected class
- **THEN** the attribute change is applied through the command route

#### Scenario: Manage enumerations from UI
- **WHEN** the user creates or edits an enumeration or its literals
- **THEN** the enumeration change is applied through the command route

#### Scenario: Manage relationships from UI
- **WHEN** the user creates, edits multiplicity for, or deletes a relationship
- **THEN** the relationship change is applied through the command route when supported by the active editor command set

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

### Requirement: Editor state separation
The workspace SHALL keep one editable canonical document session separate from UI-only and persistence-session state.

#### Scenario: Maintain current document
- **WHEN** the editor state is inspected for a loaded project
- **THEN** there is a single editable `ProjectDocument` per session exposed for rendering and synchronized with the shared history state after execute, undo, and redo

#### Scenario: Replace the session when opening another project
- **WHEN** a persisted project is structurally decoded and semantically validated for opening
- **THEN** the workspace constructs a new `UmlHistory`, replaces the current document, recomputes diagnostics, clears selection and transient tools/errors, resets undo/redo counts, records server storage version, and marks the session clean

#### Scenario: Avoid multiple editable domain copies
- **WHEN** React components, the editor store, and the history object interact
- **THEN** React components do not keep separate mutable UML model copies and the store does not maintain a second independent editable canonical model outside the controlled history/document synchronization

#### Scenario: Maintain UI state separately
- **WHEN** selection, panel visibility, active tool, transient canvas controls, save state, or storage version change
- **THEN** UI and persistence-session values do not mutate the canonical UML model except through approved metadata or UML command flows

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

### Requirement: Durable UUID generation for editor commands
The workspace SHALL create new persisted UML elements with stable UUID-based domain identifiers rather than session-local sequential identifiers.

#### Scenario: Create an element after reload
- **WHEN** a user creates a class, attribute, enumeration, literal, or relationship after opening a persisted project
- **THEN** the generated identifier is stable and does not collide with identifiers from an earlier browser session

### Requirement: Validation diagnostics in workspace
The workspace SHALL reuse the shared validation engine and present diagnostics in a way the user can understand.

#### Scenario: Show validation diagnostics
- **WHEN** the current project document is validated
- **THEN** errors and warnings are shown with severity, message, and affected element context when available

#### Scenario: Distinguish warnings and errors
- **WHEN** diagnostics include both errors and warnings
- **THEN** the workspace visually differentiates blocking errors from non-blocking warnings

#### Scenario: Navigate from diagnostic to element
- **WHEN** a diagnostic references an element displayed in the workspace
- **THEN** the user can select or focus the affected element from the diagnostic entry

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

### Requirement: CU-02 verification and documentation
The implementation SHALL document the actual CU-02 outcome and verify editor behavior with relevant automated and manual checks before closure.

#### Scenario: Frontend behavior tests cover editor contracts
- **WHEN** frontend and root automated tests are executed
- **THEN** tests cover workspace rendering, projection, class and enum nodes, representative relationship edges, editing flows, node movement, diagnostics, undo/redo, auto-layout, selection, inspector behavior, and essential responsive behavior

#### Scenario: CU-02 document records implementation
- **WHEN** CU-02 implementation is completed
- **THEN** `docs/puds/use-cases/CU-02-manual-uml-workspace.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` reflect the real implementation state and verification results

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
