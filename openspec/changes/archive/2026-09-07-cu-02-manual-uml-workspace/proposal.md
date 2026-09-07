## Why

CU-01 established the canonical UML model, validation engine, command bus, and local history, but the product still lacks a usable visual editor. CU-02 is needed now to complete Cycle 1 with a manual UML workspace that projects `ProjectDocument` into React Flow without making the canvas the domain source of truth.

## What Changes

- Add a responsive Material UI UML editor workspace in `frontend/` with app bar, sidebar/navigation, breadcrumbs, toolbox, central React Flow canvas, inspector, diagnostics area, and status bar.
- Add explicit projection adapters from `ProjectDocument.model` plus `ProjectDocument.layout` to React Flow nodes and edges.
- Add initial custom React Flow nodes for UML classes and enumerations, and differentiated relationship edges for association, aggregation, composition, and generalization.
- Add manual editing flows for classes, attributes, enumerations, relationships, multiplicities, selection, node movement, diagnostics, auto-layout, and local undo/redo.
- Route all supported semantic and layout mutations through `@examen-sw1/uml-core` commands and `UmlCommandBus`/`UmlHistory`.
- Add minimal `uml-core` command extensions only where CU-01 does not expose the operations required for the editor: enumeration creation/update/deletion, enumeration literal management, relationship deletion, generalization creation, and one batch layout command so Auto Layout is one history operation.
- Add frontend state with a single controlled editable `ProjectDocument` per session, synchronized atomically with `UmlHistory` after execute/undo/redo, while keeping UI-only state separate.
- Add demo-only in-memory project data until CU-03 introduces persistence.
- Add frontend tests covering the workspace, projection, nodes, edges, editing flows, diagnostics, undo/redo, auto-layout, selection, inspector, and responsive behavior.

## Capabilities

### New Capabilities
- `manual-uml-workspace`: Visual manual UML workspace behavior, projection to React Flow, command-driven editing, diagnostics, layout, undo/redo, responsive UI, and demo in-memory project state.

### Modified Capabilities
- `canonical-uml-core`: Extend the existing command capability minimally so the manual editor can create/update/delete enumerations and literals, delete relationships, create generalization relationships, and apply multiple layout position changes as one command through the same command bus route.

## Impact

- Affected frontend code: `frontend/app/editor/page.tsx`, editor components, React Flow adapters, Zustand store, tests, and dependency manifest.
- Affected shared package code: `packages/uml-core` command types/executors/tests only for the minimal command gaps identified above.
- New expected frontend dependencies: `@xyflow/react`, `elkjs`, and `zustand`, using versions compatible with the current Next.js 16 and React 19 setup.
- No backend, database, auth, realtime, generation, AI, voice, XMI, Flutter, AWS, or persistence implementation is in scope.
