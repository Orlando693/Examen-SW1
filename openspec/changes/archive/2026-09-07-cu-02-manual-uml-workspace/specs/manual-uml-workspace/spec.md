## Purpose

Defines the manual UML editor workspace that lets users visually create, inspect, validate, lay out, and revise an in-memory `ProjectDocument` while preserving the canonical UML model as the source of truth.

## ADDED Requirements

### Requirement: Responsive UML workspace shell
The system SHALL provide a responsive UML editor workspace with clear regions for project navigation, breadcrumbs, editing actions, canvas, properties, diagnostics, and status feedback.

#### Scenario: Use existing App Router layout
- **WHEN** the editor route is implemented
- **THEN** it uses the existing `frontend/app/editor/page.tsx` App Router structure without introducing a parallel app source tree

#### Scenario: Render desktop workspace
- **WHEN** the editor workspace is opened on a desktop viewport
- **THEN** the user can see a top application bar, navigation/sidebar area, breadcrumbs, toolbox, central UML canvas, inspector or properties panel, diagnostics area, and status bar

#### Scenario: Render compact workspace
- **WHEN** the editor workspace is opened on a reduced-width viewport
- **THEN** secondary panels are available through compact responsive controls while the canvas remains the primary interaction area

#### Scenario: Use demo document before persistence
- **WHEN** the editor opens before project persistence exists
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
The workspace SHALL support standard canvas interactions and keep node position changes in `DiagramLayout`.

#### Scenario: Use canvas navigation
- **WHEN** the user interacts with the canvas
- **THEN** zoom, pan, selection, drag or move, and fit-to-content behavior are available

#### Scenario: Move node updates layout only
- **WHEN** the user moves a UML node and the move is committed
- **THEN** the resulting project document updates `DiagramLayout` through the command route while preserving semantic UML data

#### Scenario: Auto-layout changes positions
- **WHEN** the user runs auto-layout
- **THEN** the project document receives updated diagram node positions without storing layout engine internals as domain data

#### Scenario: Auto-layout is one history operation
- **WHEN** auto-layout moves multiple nodes and the user invokes undo once
- **THEN** all positions changed by that auto-layout operation are restored together

### Requirement: Editor state separation
The workspace SHALL keep domain state separate from UI-only state.

#### Scenario: Maintain current document
- **WHEN** the editor state is inspected
- **THEN** there is a single editable `ProjectDocument` per session exposed for rendering and synchronized with the shared history state after execute, undo, and redo

#### Scenario: Avoid multiple editable domain copies
- **WHEN** React components, the editor store, and the history object interact
- **THEN** React components do not keep separate mutable UML model copies and the store does not maintain a second independent editable canonical model outside the controlled history/document synchronization

#### Scenario: Maintain UI state separately
- **WHEN** selection, panel visibility, active tool, or transient canvas controls change
- **THEN** those values are treated as UI state and do not mutate the canonical UML model

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
The workspace SHALL expose local undo and redo behavior backed by the shared UML history implementation.

#### Scenario: Undo command from UI
- **WHEN** the user invokes undo after an accepted edit
- **THEN** the current project document returns to the previous state and the canvas updates from that document

#### Scenario: Redo command from UI
- **WHEN** the user invokes redo after undo
- **THEN** the current project document returns to the redone state and the canvas updates from that document

#### Scenario: Clear redo after new edit
- **WHEN** the user performs a new accepted edit after undo
- **THEN** redo is no longer available for the previously undone operation

### Requirement: CU-02 verification and documentation
The implementation SHALL document the actual CU-02 outcome and verify editor behavior with relevant automated and manual checks before closure.

#### Scenario: Frontend behavior tests cover editor contracts
- **WHEN** frontend and root automated tests are executed
- **THEN** tests cover workspace rendering, projection, class and enum nodes, representative relationship edges, editing flows, node movement, diagnostics, undo/redo, auto-layout, selection, inspector behavior, and essential responsive behavior

#### Scenario: CU-02 document records implementation
- **WHEN** CU-02 implementation is completed
- **THEN** `docs/puds/use-cases/CU-02-manual-uml-workspace.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` reflect the real implementation state and verification results
