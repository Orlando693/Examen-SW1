## Context

CU-00 left a Next.js App Router frontend in `frontend/` and a NestJS backend in `backend/`. CU-01 added `@examen-sw1/uml-core` in `packages/uml-core` with `ProjectDocument`, `CanonicalUmlModel`, `DiagramLayout`, `validateProjectDocument`, `UmlCommandBus`, and `UmlHistory`.

The current `uml-core` public API supports `CreateClass`, `DeleteClass`, `RenameClass`, `AddAttribute`, `RemoveAttribute`, `UpdateAttribute`, `CreateAssociation`, `UpdateMultiplicity`, and `MoveNode`. It does not yet expose commands for enumeration creation/editing/deletion, enumeration literal management, relationship deletion, creating `generalization` relationships because `CreateAssociation.kind` excludes `generalization`, or applying multiple layout moves as one history operation.

CU-02 must create planning for the web editor only. It must not add persistence, auth, realtime, generation, AI, XMI, Flutter, or AWS behavior.

## Goals / Non-Goals

**Goals:**

- Deliver a functional in-memory manual UML editor in the existing `frontend/` app.
- Keep `ProjectDocument.model` as the semantic source of truth and `ProjectDocument.layout` as visual state.
- Treat React Flow nodes and edges as derived projection data only.
- Route all domain and layout mutations through `UmlCommandBus` or `UmlHistory.execute()`.
- Reuse `validateProjectDocument()` for diagnostics.
- Add only the minimal `uml-core` command extensions required for CU-02 editor actions.
- Keep client boundaries localized to the interactive editor.
- Cover behavior with meaningful frontend and root checks.

**Non-Goals:**

- No real persistence, localStorage persistence, Prisma, PostgreSQL, project CRUD backend, auth, JWT, ownership enforcement, invitations, collaboration, Socket.IO, generation, OpenAPI generated artifacts, Postman, Domain Manifest, IA, voice, vision, XMI, Flutter, or AWS.
- No replacement or reimplementation of the canonical UML model.
- No direct React component mutation of `ProjectDocument.model` or direct persistence of React Flow structures as UML domain.

## Decisions

### 1. Frontend Route And Component Structure

Decision: Add the editor route at `frontend/app/editor/page.tsx`, matching the existing CU-00 App Router layout. Do not create a parallel source-based App Router tree or migrate the existing app structure during CU-02. The page remains a Server Component that renders a client editor shell.

Proposed component areas:

- `EditorPage`: server entry that sets metadata and renders the client boundary.
- `UmlEditorClient`: client boundary owning interactive editor providers and store wiring.
- `EditorAppBar`: project title, breadcrumbs summary, Undo, Redo, Auto Layout, Fit View, and compact panel actions.
- `EditorSidebar`: project/workspace navigation and demo-state notice.
- `EditorToolbox`: select, create class, create enum, relationship tools, fit view.
- `UmlCanvas`: React Flow surface, node/edge registration, selection, drag/move, connect, fit view.
- `UmlClassNode` and `UmlEnumNode`: custom nodes derived from UML elements.
- `UmlRelationshipEdge`: edge rendering/styling differentiated by relationship kind.
- `InspectorPanel`: selected element editor with properties and relationships sections.
- `DiagnosticsPanel`: validation diagnostics list and navigation to affected elements.
- `EditorStatusBar`: revision, selected element, error/warning counts, and demo/local status.

Alternatives considered: putting the whole editor in `page.tsx` would be simpler initially but would blur server/client boundaries and make tests harder. Splitting every tiny control into separate folders immediately would over-structure CU-02; start with cohesive editor modules and split only where tests or reuse require it.

### 2. Server Component / Client Component Boundary

Decision: Keep App Router route files server by default and place `'use client'` only in the interactive editor root and components that use React Flow, browser events, Zustand hooks, or local interaction state.

Rationale: React Flow needs browser APIs and event handling, but the whole frontend does not need to become client-rendered.

Alternative considered: mark the route as client. Rejected because it expands the client boundary unnecessarily and conflicts with the App Router discipline requested for CU-02.

### 3. Store Architecture

Decision: Use Zustand for the editor store because product.md and AGENTS.md list Zustand as the frontend state tool, and CU-02 needs shared interactive state across canvas, toolbox, inspector, diagnostics, and app bar.

Chosen source-of-truth strategy: `UmlHistory` is the controlled domain state holder for the editable session, and the Zustand store exposes a `currentDocument` snapshot only for React rendering. That exposed document is not independently editable. It is replaced atomically after every accepted `execute`, `undo`, or `redo` result from `UmlHistory`.

Store shape:

- Domain state: one `UmlHistory` instance for the session and one read-only-by-convention `currentDocument` render snapshot copied from `history.document`.
- UI state: selected element id/type, active tool, relationship creation draft, drawer/panel visibility, transient command error, and diagnostics derived after document changes.
- Actions: command wrappers such as `createClass`, `renameClass`, `deleteClass`, `addAttribute`, `updateAttribute`, `removeAttribute`, `createEnumeration`, `createRelationship`, `updateMultiplicity`, `deleteRelationship`, `moveNode`, `autoLayout`, `undo`, and `redo`.

Atomic synchronization rule:

- `execute(command)`: call `history.execute(command)`; if accepted, replace `currentDocument` with `result.document`, recompute diagnostics from that document, update undo/redo counts from the same history instance, and then recompute projection.
- `undo()`: call `history.undo()`; if successful, replace `currentDocument` with `result.document`, recompute diagnostics, update undo/redo counts, and then recompute projection.
- `redo()`: call `history.redo()`; if successful, replace `currentDocument` with `result.document`, recompute diagnostics, update undo/redo counts, and then recompute projection.

The store must not maintain a second canonical UML object, copied React Flow graph as domain, component-local mutable UML state, or independent history stack. React Flow nodes/edges can be memoized or computed for render, but the source is the synchronized `currentDocument` snapshot produced by `UmlHistory`.

Forbidden state shape for CU-02: component-local UML model state plus Zustand UML model state plus `UmlHistory` internal state as three independently editable copies.

Alternative considered: React context plus reducers. Rejected because shared editor actions across non-adjacent panels would become noisy, and Zustand is already part of the decided stack.

### 4. Integration With `@examen-sw1/uml-core`

Decision: Import domain types, factory helpers, validators, `UmlCommandBus`, `UmlHistory`, and command types from `@examen-sw1/uml-core`. All semantic and layout edits call store actions that build `UmlCommand` objects and execute them via the session `UmlHistory.execute()` so Undo/Redo stays in the shared core history. Direct `UmlCommandBus` use in frontend should be limited to exceptional non-history validation/execution cases; normal editor mutations must go through history.

Direct model changes are allowed only in pure read/projection code. Editor actions must not push directly into `document.model.classes`, `document.model.enumerations`, `document.model.relationships`, or `document.layout.nodes`.

### 5. Projection UML To React Flow

Decision: Add explicit adapter functions in frontend editor code:

- `projectDocumentToFlow(document, selection)` returns React Flow nodes and edges.
- `classToFlowNode(umlClass, layoutNode)` maps class data to node props.
- `enumToFlowNode(enumeration, layoutNode)` maps enum data to node props.
- `relationshipToFlowEdge(relationship)` maps relationship kind, endpoints, name, and multiplicities to edge props.
- `flowNodeMoveToCommand(nodeChange)` converts final single-node position changes to `MoveNode` commands.
- `layoutResultToApplyLayoutCommand(layoutResult)` converts multi-node auto-layout results to one `ApplyLayout` command.

React Flow `data` should contain only render-ready values and stable references needed by UI handlers, such as element id, label, rows, relationship kind, and diagnostics count. It must not become the only place where UML attributes, literals, or multiplicities are stored.

Default positions: if an element has no layout node, projection may assign temporary deterministic fallback coordinates for display. Committed positions must be written back through `MoveNode`.

### 6. Custom Nodes

Decision: Implement two initial node types.

- Class node: header with class name, compact attributes compartment, operations compartment when non-empty, selected/error/warning styling, and connection handles.
- Enumeration node: header with enumeration name, literals compartment, selected/error/warning styling, and connection handles only if relationship creation from enum is intentionally disabled or unsupported.

Relationships in the current core point to class ids only, so CU-02 should not allow class-to-enum relationships unless `uml-core` is explicitly extended for that later. Enum nodes are visual/editable elements but not relationship endpoints in CU-02.

### 7. Custom Edges

Decision: Provide one relationship edge renderer/style mapper that differentiates:

- association: solid neutral line;
- aggregation: line with hollow diamond marker at the aggregate side when supported by the edge renderer;
- composition: line with filled diamond marker;
- generalization: line with triangular inheritance marker.

Multiplicity labels should be shown near source/target when present. Perfect academic UML notation is not required in CU-02, but the mapping must be clear and extensible.

### 8. UI Actions To `UmlCommand`

Decision: Centralize translation in editor action/adapters rather than inside visual components.

Examples:

- create class tool on canvas click -> `CreateClass` plus initial `MoveNode` if a position is chosen;
- class name field submit -> `RenameClass`;
- attribute add/edit/delete controls -> `AddAttribute`, `UpdateAttribute`, `RemoveAttribute`;
- relation creation -> `CreateAssociation` with selected relationship kind, or new generalization-capable command extension;
- multiplicity form submit -> `UpdateMultiplicity`;
- node drag stop -> `MoveNode`;
- auto-layout result -> `ApplyLayout` with all calculated node positions;
- delete selected relationship -> new `DeleteRelationship` command extension.

For create-at-position, the implementation can use a fixed default layout on creation followed by `MoveNode`; if that creates undesirable double-undo behavior for class creation, document it as a limitation or propose a later targeted batch command. For Auto Layout specifically, multiple sequential `MoveNode` history entries are not allowed: it must be one `ApplyLayout` command and one history entry.

### 9. Selection And Inspector

Decision: Selection is UI state keyed by canonical element id and element type. Canvas selection and diagnostics navigation both update the same selection state. The inspector reads the selected element from the current `ProjectDocument` each render.

Inspector tabs/sections:

- Properties: names and basic fields for classes/enums/relationships.
- Attributes/Literals: class attributes or enum literals.
- Relationships: relationship kind, source/target summary, multiplicities when supported.
- Validation: diagnostics affecting selected element.

Forms should commit on explicit user action or safe blur/enter behavior. Rejected command results should keep the previous document and expose a clear error message.

### 10. Toolbox

Decision: Keep toolbox compact and action-oriented with tools for select, class, enum, association, aggregation, composition, generalization, and fit view. Relationship tools enter a short interaction mode where the user selects source and target class nodes.

Alternative considered: modal-only creation. Rejected because the CU specifically needs a visual editor; modals can be used for details but not as the only workflow.

### 11. Diagnostics

Decision: Recompute diagnostics with `validateProjectDocument(document)` after accepted domain-changing actions and after undo/redo. Store diagnostics as derived state or recompute via selector; do not create frontend validation rules that duplicate the shared validator.

Diagnostics UI:

- ERROR: red Material styling and blocking command feedback when returned by command result.
- WARNING: amber Material styling, visible but non-blocking.
- Element diagnostics: selectable/focusable when `elementId` exists.

### 12. MoveNode And `DiagramLayout`

Decision: Use final drag-stop events to call `MoveNode`. During drag, React Flow may hold transient positions internally for interaction smoothness, but committed state must be reconciled from `ProjectDocument.layout` after command acceptance.

This avoids high-frequency command spam and preserves the rule that persisted layout is `DiagramLayout`, not React Flow state.

### 13. ELK Auto Layout

Decision: Add a layout adapter that converts the current projected graph to a temporary ELK graph, runs ELK layout from a user-triggered Auto Layout action, then writes all resulting positions back through one new `ApplyLayout` command.

ELK inputs/outputs are temporary implementation details. Only `DiagramLayout.nodes[].position` and optional size are retained in the domain document.

Undo behavior: Auto Layout must be exactly one history operation. One Undo restores every node position changed by the Auto Layout operation; one Redo reapplies every calculated position. The `ApplyLayout` executor updates only `DiagramLayout` and never mutates `CanonicalUmlModel`.

### 14. Undo/Redo

Decision: Use `UmlHistory` from `@examen-sw1/uml-core` as the only domain history. The UI reads `undoCount` and `redoCount` for button disabled states. `undo()` and `redo()` update the current document from history results and then recompute projection/diagnostics.

No React-only domain undo stack is allowed. React Flow's internal history, if any, must not be used as the UML edit history.

### 15. Responsive Layout

Decision: Use Material responsive primitives and CSS breakpoints.

- Desktop: persistent left navigation/toolbox and right inspector/diagnostics panel.
- Tablet: collapsible side panels with the canvas dominant.
- Mobile viewport: navigation and inspector become drawers or bottom-sheet-like panels, with primary creation/selection actions reachable from toolbar/menu controls.

Essential responsive behavior should be testable by viewport-size mocks or DOM state assertions where practical.

### 16. Test Strategy

Decision: Use Vitest and React Testing Library in `frontend/`. Mock browser APIs needed by React Flow and ELK where necessary, but keep tests behavior-focused.

Required coverage:

- workspace render;
- editor route exists under `frontend/app/editor/page.tsx` with client boundary below the server page;
- one controlled domain source between Zustand and `UmlHistory` after execute/undo/redo;
- projection from `ProjectDocument` to visual graph;
- class node and enum node rendering;
- representative relationship edge rendering;
- create class, rename class, attribute add/edit/delete;
- create enum and edit literals;
- create relationship and edit multiplicity;
- move node updates layout and not model;
- diagnostics ERROR/WARNING display and selection from diagnostic;
- Undo/Redo and redo clearing after new edit;
- auto-layout moves multiple nodes, creates one history entry, Undo restores all previous positions, and Redo reapplies all positions;
- selection and inspector behavior;
- essential responsive panel behavior.

Root checks must remain green: `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build`, plus frontend-specific equivalents.

### 17. Demo Data Before CU-03

Decision: Add a small deterministic demo `ProjectDocument` factory in frontend editor code, clearly named as temporary demo state. It can include classes, attributes, one enum, and representative relationships for visual validation.

No localStorage, PostgreSQL, Prisma, backend CRUD, or other persistence should be added. Page reload may reset the demo document until CU-03.

### 18. Minimal `uml-core` Extensions Required

Decision: Extend the existing command union/executors/tests, not the model architecture, with only:

- `CreateEnumeration`;
- `RenameEnumeration` or `UpdateEnumeration` for name changes;
- `DeleteEnumeration`;
- `AddEnumerationLiteral`;
- `UpdateEnumerationLiteral`;
- `RemoveEnumerationLiteral`;
- `CreateGeneralization` or a generalized relationship creation command that preserves current association semantics;
- `DeleteRelationship`.
- `ApplyLayout`.

Rationale: These operations are necessary for the CU-02 editor requirements and must still use the established command bus route. They do not change the canonical data model itself because CU-01 already defined enumerations, literals, relationships, and generalization types.

`ApplyLayout` input should be typed as a list of layout updates containing `elementId`, `position`, and optional `size`/`nodeId` only as needed by `DiagramLayout`. It must update only `DiagramLayout`, support multiple nodes in one command, validate missing element references through the existing validator contract, and integrate with `UmlHistory` as one accepted command.

Rejected alternative: Let frontend mutate enumerations or relationships directly. This violates AGENTS.md and product.md. Rejected alternative: redesign `uml-core` command architecture. Unnecessary for CU-02; add minimal commands only.

## Risks / Trade-offs

- React Flow tests can be brittle in jsdom -> Mitigate by testing projection adapters separately and using focused integration tests for visible UI behavior.
- `ApplyLayout` adds a second layout command beside `MoveNode` -> Mitigate by keeping `MoveNode` for direct single-node drag commits and reserving `ApplyLayout` for multi-node layout intents that must be one history operation.
- React 19 and Next.js 16 compatibility with `@xyflow/react` must be verified before installing -> Mitigate by checking package peer dependencies during implementation and selecting compatible versions.
- The current `UmlHistory` instance stores private document state -> Mitigate by making store actions the only route to execute/undo/redo and by replacing/reinitializing history only when intentionally loading a different demo document.
- UI may accidentally duplicate domain state in React Flow state -> Mitigate with tests around projection and movement, and code review rule that canonical arrays are only updated via commands.

## Migration Plan

CU-02 is not a data migration. The implementation plan is:

1. Add frontend dependencies needed by the editor.
2. Add minimal `uml-core` command extensions and tests, including `ApplyLayout` for Auto Layout as one Undo/Redo operation.
3. Add the editor route, store, projection adapters, nodes, edges, and UI panels.
4. Add ELK auto-layout, diagnostics, Undo/Redo, responsive behavior, and tests.
5. Update CU-02 documentation, `STATUS.md`, and `HANDOFF.md` during implementation.

Rollback strategy during development is to revert the CU-02 commit before archive if needed. No persisted user data exists for CU-02.
