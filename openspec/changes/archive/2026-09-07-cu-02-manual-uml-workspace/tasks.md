## 1. Increment 1 - Workspace Shell And Visual Projection

- [x] 1.1 Confirm the worktree is clean, CU-00/CU-01 commits are pushed, and no OpenSpec change other than `cu-02-manual-uml-workspace` is active.
- [x] 1.2 Review current frontend structure and package versions before adding dependencies.
- [x] 1.3 Add only CU-02 frontend dependencies required by the design: `@xyflow/react`, `elkjs`, and `zustand`, using versions compatible with Next.js 16 and React 19.
- [x] 1.4 Create the editor route at `frontend/app/editor/page.tsx` with a Server Component page and a localized client boundary for the interactive UML editor.
- [x] 1.5 Build the Material UI workspace shell with app bar, sidebar/navigation, breadcrumbs, toolbox area, central canvas region, inspector/properties area, diagnostics area, and status bar.
- [x] 1.6 Add deterministic demo-only in-memory `ProjectDocument` creation for CU-02, clearly labeled as temporary until CU-03 persistence.
- [x] 1.7 Implement explicit projection adapters from `ProjectDocument.model` plus `ProjectDocument.layout` to React Flow nodes and edges.
- [x] 1.8 Implement custom class and enumeration nodes that render names, attributes, operations, and literals without storing canonical UML data exclusively in React Flow state.
- [x] 1.9 Implement differentiated relationship edge projection for association, aggregation, composition, and generalization.
- [x] 1.10 Integrate React Flow canvas behavior for zoom, pan, selection, drag/move interaction, and fit view.
- [x] 1.11 Implement editor state with one controlled `UmlHistory` domain holder and a synchronized `currentDocument` render snapshot, keeping UI-only selection, active tool, panels, drafts, and transient errors separate.
- [x] 1.12 Add tests for the correct `frontend/app/editor/page.tsx` route, workspace render, projection adapters, class node, enum node, representative edge, selection state, single source-of-truth store/history synchronization, and initial responsive shell behavior.

## 2. Increment 2 - Command-Driven Manual Editing And Diagnostics

- [x] 2.1 Extend `packages/uml-core` command types, executors, and tests minimally for `CreateEnumeration`, enumeration rename/update, `DeleteEnumeration`, literal add/update/remove, generalization creation, `DeleteRelationship`, and `ApplyLayout`.
- [x] 2.2 Verify new `uml-core` commands preserve command result shape, validation behavior, cloning, and non-mutating caller-owned document contracts.
- [x] 2.3 Implement frontend action adapters that translate UI intents into `UmlCommand` objects and execute normal editor mutations through the session `UmlHistory.execute()`.
- [x] 2.4 Implement toolbox flows for select, create class, create enum, association, aggregation, composition, and generalization tools.
- [x] 2.5 Implement class editing from the inspector: select class, rename class, delete class, add attribute, edit attribute, and remove attribute.
- [x] 2.6 Implement enumeration editing from the inspector: create enum, rename/update enum, add/edit/remove literals, and delete enum.
- [x] 2.7 Implement relationship creation, selection, multiplicity editing, and relationship deletion using command-bus operations.
- [x] 2.8 Ensure node move commits call `MoveNode` and update only `DiagramLayout`, not semantic `model` data.
- [x] 2.9 Reuse `validateProjectDocument()` after relevant operations and show ERROR/WARNING diagnostics with element context and diagnostic-to-selection navigation.
- [x] 2.10 Add tests for creating class, renaming class, adding/editing/removing attributes, creating/editing enum and enum literals, creating relationship, creating generalization, editing multiplicity, deleting relationship, node movement layout-only behavior, new `uml-core` enum/relationship/layout commands, and diagnostics display/navigation.

## 3. Increment 3 - Auto Layout, Undo/Redo, Responsive Hardening, Verification, And Documentation

- [x] 3.1 Implement ELK auto-layout adapter from the current projected graph to temporary ELK graph data and back to `DiagramLayout` updates via one `ApplyLayout` command.
- [x] 3.2 Expose Undo and Redo controls backed by `UmlHistory`, including enabled/disabled states from `undoCount` and `redoCount`.
- [x] 3.3 Verify Undo/Redo behavior for semantic edits, node moves, `ApplyLayout`, and redo clearing after a new accepted operation following undo.
- [x] 3.4 Harden responsive behavior for desktop, tablet, and mobile viewports using drawers, collapsible panels, or bottom-sheet-like panels where appropriate.
- [x] 3.5 Add tests for Undo from UI, Redo from UI, redo clearing, auto-layout moving multiple nodes as one history entry, Undo restoring all previous auto-layout positions, Redo reapplying all auto-layout positions, inspector behavior, toolbox behavior, and essential responsive interactions.
- [x] 3.6 Run frontend-specific checks: `npm run test --workspace frontend`, `npm run typecheck --workspace frontend`, `npm run lint --workspace frontend`, and `npm run build --workspace frontend`.
- [x] 3.7 Run `uml-core` checks after command extensions: `npm run test --workspace @examen-sw1/uml-core`, `npm run typecheck --workspace @examen-sw1/uml-core`, `npm run lint --workspace @examen-sw1/uml-core`, and `npm run build --workspace @examen-sw1/uml-core`.
- [x] 3.8 Run root checks: `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 3.9 Create `docs/puds/use-cases/CU-02-manual-uml-workspace.md` documenting objective, scope, UI architecture, component structure, `uml-core` integration, React Flow projection, frontend state, Command Bus usage, inspector, toolbox, relationships, diagnostics, ELK, Undo/Redo, responsive behavior, tests, errors, corrections, limitations, debt, and final result based on actual implementation.
- [x] 3.10 Update `docs/STATUS.md` and `docs/HANDOFF.md` during implementation to reflect CU-02 active state, current increment, verification status, known issues, and next action.
- [x] 3.11 Verify that CU-02 did not implement CU-03+ scope: no real persistence, Prisma/PostgreSQL project CRUD, auth, JWT, Socket.IO collaboration, generation, AI, voice, vision, XMI, Flutter, or AWS behavior.
- [x] 3.12 Run `openspec validate "cu-02-manual-uml-workspace" --strict` and address discrepancies before requesting user acceptance.

## 4. Corrective Iteration - Manual Browser Feedback

- [x] 4.1 Reproduce and analyze the reported `Maximum update depth exceeded` failure observed on `/editor` after the initial CU-02 implementation.
- [x] 4.2 Prevent redundant Zustand writes for unchanged selection and active-tool state.
- [x] 4.3 Memoize React Flow interaction callbacks that participate in selection, node click, edge click, and node drag commits.
- [x] 4.4 Harden compact responsive behavior so sidebar and inspector use temporary drawers instead of fixed desktop columns on small viewports.
- [x] 4.5 Add regression tests for initial render without commands/store updates, redundant selection updates, drag committing only at drag stop, Undo/Redo synchronization, projection purity, and compact responsive controls.
- [x] 4.6 Re-run frontend, `uml-core`, root checks, `openspec status`, `openspec validate --strict`, `git diff --check`, and `git status --short --untracked-files=all` after the correction.

## 5. Final Corrective Iteration - Second Manual Browser Feedback

- [x] 5.1 Fix duplicate React keys in enum literal rendering by projecting and rendering stable `UmlEnumerationLiteral.id` values instead of using literal text as the key.
- [x] 5.2 Review the current `uml-core` literal and validation contracts; keep duplicate literal names allowed for CU-02 because literals already have stable IDs and current validation only requires non-empty names.
- [x] 5.3 Fix React Flow parent sizing by making the editor root, workspace, canvas region, and canvas use valid `100dvh`/`minmax(0, 1fr)`/flex width-height constraints instead of relying on an artificial canvas min-height.
- [x] 5.4 Harden compact responsive behavior so the AppBar wraps, StatusBar avoids horizontal overflow, toolbox scrolls when wrapped, MiniMap is hidden on compact viewports, and Drawers remain overlays.
- [x] 5.5 Add attribute type editing in the inspector using `UpdateAttribute.attributeType` and existing `UmlTypeRef` shapes from `uml-core`.
- [x] 5.6 Add regression tests for duplicate literal names without React key warnings, add/edit/remove enum literals, dimensionable compact canvas layout, attribute type change, UpdateAttribute synchronization, and Undo/Redo for attribute type changes.

## 6. Corrective Iteration - Relationship Flow And Functional Polish

- [x] 6.1 Analyze manual failure of relationship creation across association, aggregation, composition, and generalization.
- [x] 6.2 Replace time-based editor-generated ids with a monotonic session counter to avoid duplicate relationship/literal/class/attribute ids during rapid interactions.
- [x] 6.3 Add explicit relationship draft feedback, source selection highlight through UI selection, cancel via Selection tool, cancel via Escape, and controlled self-relation rejection without mutating `ProjectDocument`.
- [x] 6.4 Verify relationship creation executes exactly one UML command for source-to-target completion and preserves kind/source/target for association, aggregation, composition, and generalization.
- [x] 6.5 Rework the attribute inspector section into usable per-attribute cards with full-width name, type, and delete controls.
- [x] 6.6 Defer React Flow mounting until a measured canvas container exists, refit the visual viewport on dimension/breakpoint/layout changes, and avoid changing `DiagramLayout` for viewport-only behavior.
- [x] 6.7 Add regression tests for all relationship UI flows, relationship draft cleanup/cancel/rejection, inspector name/type editing, viewport fit without layout mutation, compact behavior, stable render, and existing enum literal key coverage.

## 7. Corrective Iteration - React Flow StoreUpdater Loop Root Cause

- [x] 7.1 Re-analyze the fourth manual-browser failure: React Flow warning #004 plus `Maximum update depth exceeded` with stack through `StoreUpdater`, `setNodes`, `setState`, `ReactFlow`, `CanvasInner`, and `UmlCanvas`.
- [x] 7.2 Remove `useReactFlow().fitView` from the parent effect dependency path and capture the React Flow instance through stable `onInit` instead.
- [x] 7.3 Make canvas readiness one-way after the first positive measurement so React Flow is not repeatedly mounted/unmounted by transient zero-size observer events.
- [x] 7.4 Round `ResizeObserver` measurements and ignore same-size repeats to avoid subpixel measurement churn.
- [x] 7.5 Gate `fitView()` with a stable fit key based on breakpoint, rounded dimensions, and layout positions so rerenders with unchanged graph state do not write repeatedly to React Flow's internal store.
- [x] 7.6 Add regression tests for same-document rerender stability and repeated same-size `ResizeObserver` measurements without editor-store writes or repeated `fitView()` calls.
- [x] 7.7 Re-run frontend, `uml-core`, root checks, `openspec status`, `openspec validate --strict`, and HTTP `/editor` route smoke after the root-cause correction.
- [x] 7.8 Manually verify in a real browser console that `/editor` has no React Flow #004 warning and no `Maximum update depth exceeded` during initial load, 20s idle, create class, select node, move node, and resize.

## 8. Final Stability Iteration - Visual, Responsive, And Usability

- [x] 8.1 Re-analyze the persistent browser React Flow #004 warning after the StoreUpdater loop was removed and identify the failing layout/parent chain.
- [x] 8.2 Rework the editor/canvas DOM/CSS so the editor root is a fixed viewport-height vertical grid and React Flow mounts inside a real absolute `inset: 0` dimensioned wrapper.
- [x] 8.3 Simplify `ResizeObserver` usage so it only records real resize/readiness information and never drives repeated React Flow mount/unmount cycles.
- [x] 8.4 Keep `fitView()` acotado to first valid mount, real responsive/resize changes, and layout-position changes without mutating `DiagramLayout`.
- [x] 8.5 Redesign the desktop toolbox as a readable vertical action panel with full labels, clear active state, and no horizontal scrollbar.
- [x] 8.6 Redesign the compact toolbox as an intentional horizontal responsive toolbar that preserves tool identity without narrowing a floating vertical panel over the canvas.
- [x] 8.7 Polish AppBar, StatusBar, sidebar/inspector widths, overflow behavior, and discrete interaction feedback while preserving CU-02 scope and the existing relationship flow.
- [x] 8.8 Add or reinforce regression tests for dimensionable canvas wrapper, non-mutating responsive resize, toolbox labels/presentations, compact status truncation, relationship overlay, render stability, and relation flows.
- [x] 8.9 Re-run all required frontend, `uml-core`, root, OpenSpec, diff, and status checks.
- [x] 8.10 Perform real-browser console verification if available; otherwise document that manual browser verification by the user remains authoritative.

## 9. Local Design Skill - UML Editor Visual Coherence

- [x] 9.1 Review the current OpenCode project skill format and confirm `.opencode/skills/<name>/SKILL.md` with YAML frontmatter is the supported structure.
- [x] 9.2 Create local project skill `uml-editor-design` under `.opencode/skills/uml-editor-design/SKILL.md` with a specific name and trigger description for UML editor visual work.
- [x] 9.3 Add `references/design-system.md` defining project-specific color, typography, density, spacing, radius, shadow, and state-token guidance.
- [x] 9.4 Add `references/editor-patterns.md` defining AppBar, sidebar, toolbox, canvas, nodes, edges, selection, relationship creation, inspector, diagnostics, status bar, drawers, tablet, and mobile patterns.
- [x] 9.5 Add `references/ui-audit.md` documenting the real current CU-02 visual state, risks, constraints, and anti-generic-design guidance.
- [x] 9.6 Document that this phase creates support tooling only and does not redesign the editor UI.
- [x] 9.7 Validate skill structure/frontmatter and update CU-02 documentation; note that OpenCode may require restart to discover the new skill.

## 10. Design-System Application - Technical Canvas / Modeling IDE

- [x] 10.1 Explicitly load and apply the local `uml-editor-design` skill and read `design-system.md`, `editor-patterns.md`, and `ui-audit.md` before component edits.
- [x] 10.2 Produce the required design brief for Technical Canvas / Modeling IDE direction and choose a canvas-first desktop/tablet/mobile layout strategy.
- [x] 10.3 Redesign the toolbox as grouped editor tooling for Selection, Elements, Relationships, and Layout without changing command behavior.
- [x] 10.4 Refine sidebar, AppBar, StatusBar, and editor chrome with the restrained technical blue design system and no arbitrary accent palette.
- [x] 10.5 Refactor the inspector into contextual sections and add compact empty-state and selected-element diagnostics summaries.
- [x] 10.6 Restyle diagnostics panel, UML class/enum nodes, and relationship edges for clearer editor hierarchy while preserving semantics.
- [x] 10.7 Preserve the React Flow `react-flow-host` sizing structure and verify responsive/viewport changes do not mutate `DiagramLayout`.
- [x] 10.8 Update focused tests for grouped toolbox and contextual inspector/diagnostics while preserving relationship, undo/redo, projection, and resize tests.
- [x] 10.9 Update CU-02 documentation and handoff/status with the applied design skill, visual direction, components changed, checks, and remaining manual visual/browser validation.

## 11. Visual Direction Correction - Blueprint Workbench

- [x] 11.1 Reload and apply `uml-editor-design`, including `design-system.md`, `editor-patterns.md`, and `ui-audit.md`, before UI edits.
- [x] 11.2 Update the local design skill and references from the generic `Technical Canvas / Modeling IDE` direction to the specific `Blueprint Workbench` signature.
- [x] 11.3 Define the Blueprint Workbench brief using Ink, Primary, Signal, Canvas, Panel, Grid, Border, secondary text, warning, and error tokens.
- [x] 11.4 Recompose the desktop editor away from left floating vertical toolbox toward model rail, dominant technical canvas, bottom Tool Dock, contextual property sheet, and IDE status bar.
- [x] 11.5 Replace the desktop vertical toolbox with a bottom Tool Dock and a Relation menu for association, aggregation, composition, and generalization.
- [x] 11.6 Convert sidebar presentation into Model Rail / Explorer with compact `LOCAL DEMO` state instead of a large alert card.
- [x] 11.7 Refine inspector into property-sheet sections and keep selected diagnostics contextual.
- [x] 11.8 Apply Blueprint node/edge/canvas/AppBar/StatusBar styling while preserving React Flow host sizing and UML semantics.
- [x] 11.9 Update tests for the new Tool Dock, relationship menu, Model Rail state, node signature, and contextual inspector.
- [x] 11.10 Run required frontend/root/OpenSpec/git checks and document remaining manual visual/browser validation.

## 12. Corrective Iteration - Responsive, React Flow #004, And Relationships

- [x] 12.1 Register the manual browser failure where compact responsive mode still compressed controls and React Flow #004 persisted.
- [x] 12.2 Preserve the accepted desktop Blueprint Workbench composition while changing compact mode to AppBar, canvas-first workspace, bottom Tool Dock, compact StatusBar, and Drawer overlays for Model Rail and Property Sheet.
- [x] 12.3 Make React Flow readiness depend on real host `offsetWidth`/`offsetHeight` when available, keep `react-flow-host` as the direct absolute `inset: 0` parent, and avoid a `height: 100%` parent chain for the host.
- [x] 12.4 Ensure compact AppBar exposes only Menu, truncated title, Undo, Redo, and Properties access; move secondary compact actions to the Tool Dock `More` menu.
- [x] 12.5 Keep desktop Tool Dock unchanged while compact Tool Dock exposes Select, Clase, Relation, and More with internal overflow only.
- [x] 12.6 Prioritize relationship source/target handling in `onNodeClick` while relation mode is active and ignore React Flow selection-change noise during relation mode.
- [x] 12.7 Reinforce tests for compact drawers, compact More menu, host sizing structure, breakpoint resize without `DiagramLayout` mutation, and association/aggregation/composition/generalization command results.
- [x] 12.8 Re-run required frontend/root/OpenSpec/git checks and document that task 7.8 remains pending until the user confirms a real browser console pass.

## 13. Corrective Iteration - Strict React Flow Parent Readiness

- [x] 13.1 Register the repeated manual browser failure after iteration 12: `/editor` returned 200 but React Flow #004 still appeared in the browser console.
- [x] 13.2 Identify the direct DOM parent of `<ReactFlow />` as the `react-flow-host` element rendered by `UmlCanvas`, not an ancestor React component name.
- [x] 13.3 Remove permissive readiness fallback from `ResizeObserver.contentRect` and require real direct-host `clientWidth`/`clientHeight` or equivalent layout box measurements before mounting React Flow.
- [x] 13.4 Start React Flow readiness through `requestAnimationFrame` polling of the direct host so style/layout can settle before the first mount.
- [x] 13.5 Keep readiness one-way after a positive measurement and keep `ResizeObserver` limited to resize/refit measurements after mount, not repeated mount/unmount control.
- [x] 13.6 Add a regression test proving React Flow does not mount when `contentRect` is non-zero but the direct host still reports `0x0`, and mounts only after the direct host reports non-zero dimensions.
- [x] 13.7 Re-run required checks and keep task 7.8 pending until user confirms the real browser console is clean.

## 14. Diagnostic Iteration - Hydration Breakpoint Transient Mount

- [x] 14.1 Register new Chrome evidence: final DOM has 1 `react-flow-host`, 1 `.react-flow`, 1 `.react-flow__renderer`, each with non-zero final size `464 x 1360.5`, so React Flow #004 is transient rather than a final zero-size renderer state.
- [x] 14.2 Audit editor `useMediaQuery` usage and confirm it affected `UmlEditorClient` desktop/compact composition and `EditorStatusBar` compact metadata without `{ noSsr: true }`.
- [x] 14.3 Audit `fitView()` usage and confirm the only automatic call is in `UmlCanvas` after measured mount, keyed by compact state, host dimensions, and layout positions.
- [x] 14.4 Prevent React Flow from mounting during hydration/breakpoint transient state by using MUI `useMediaQuery(..., { noSsr: true })` for editor breakpoints and delaying canvas measurement/mount until client hydration completes.
- [x] 14.5 Preserve the same canvas DOM branch for desktop and compact mode; keep only side panels/drawers conditional around it.
- [x] 14.6 Adjust compact automatic `fitView` to use less aggressive padding and a readable mobile `minZoom`, preserving pan/zoom and never mutating `DiagramLayout` on resize.
- [x] 14.7 Add tests for React Flow not remounting on same-tree rerender and for compact automatic fitView using readable minimum zoom.
- [x] 14.8 Re-run required checks and keep task 7.8 pending until user confirms the real browser console is clean.

## 15. Corrective Iteration - Hydration/SSR Markup Mismatch

- [x] 15.1 Register Ctrl+F5 Chrome evidence: hydration failed because the server rendered desktop-safe markup while the first client render expected compact `Menu` button markup in `EditorAppBar`.
- [x] 15.2 Revert the problematic `useMediaQuery(..., { noSsr: true })` decision for markup-affecting breakpoints because it allowed first client render to diverge from server HTML.
- [x] 15.3 Add an explicit hydration guard in `UmlEditorClient`: server and first client hydration render use `compact=false`; after hydration, the real media query value controls responsive UI.
- [x] 15.4 Pass the guarded compact value to `EditorStatusBar` so it no longer runs an independent markup-affecting media query during hydration.
- [x] 15.5 Keep React Flow gated by the parent editor hydration state plus direct-host size measurement, without changing the accepted desktop Blueprint Workbench design.
- [x] 15.6 Verify no `Date.now`, `Math.random`, `crypto.randomUUID`, or dynamic UUID generation runs in editor initial render; demo data remains deterministic.
- [x] 15.7 Confirm existing MUI App Router integration uses `AppRouterCacheProvider` from `@mui/material-nextjs/v16-appRouter` and does not require dependency changes.
- [x] 15.8 Add SSR regression coverage proving initial server HTML remains on the desktop-safe branch and does not render compact-only `Menu`/`Props` before hydration.
- [x] 15.9 Re-run required checks and keep task 7.8 pending until user confirms the real browser console is clean.
