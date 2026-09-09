## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Persisted editor save state
The workspace SHALL track dirty, saving, saved, error, and conflict semantics from persistible metadata, model, and layout relative to the last server-confirmed snapshot.

#### Scenario: Mark an unsaved canonical edit dirty
- **WHEN** an accepted UML command changes model or layout away from the last saved persistible snapshot
- **THEN** the workspace marks the editor session dirty without treating transient UI changes as persisted changes

#### Scenario: Undo to the saved snapshot
- **WHEN** undo returns model, layout, and editable metadata to the last server-confirmed persistible snapshot
- **THEN** the workspace marks the session clean

#### Scenario: Preserve Undo and Redo after save
- **WHEN** manual save succeeds
- **THEN** the workspace retains the existing local `UmlHistory`, updates only persistence-session values and saved snapshot, and keeps Undo/Redo available

#### Scenario: Retain local work after save failure
- **WHEN** a manual save fails due to validation, network, or stale conflict
- **THEN** the workspace retains the current document and local Undo/Redo history and remains dirty

### Requirement: Durable UUID generation for editor commands
The workspace SHALL create new persisted UML elements with stable UUID-based domain identifiers rather than session-local sequential identifiers.

#### Scenario: Create an element after reload
- **WHEN** a user creates a class, attribute, enumeration, literal, or relationship after opening a persisted project
- **THEN** the generated identifier is stable and does not collide with identifiers from an earlier browser session
