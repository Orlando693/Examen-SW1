# Project Regressions And Guardrails

These are reusable guardrails, not one-off workarounds.

1. Redundant Zustand selection or writes can cause a render loop. Select minimal state and guard no-op updates.
2. React Flow controlled `nodes` and `edges` props require stable references when their semantic inputs have not changed.
3. `ResizeObserver` callbacks must not continuously write layout or state from unchanged measurements.
4. Do not execute `fitView` on every render. Trigger it only for meaningful, controlled visual changes.
5. React Flow nodes and edges are projections of the canonical project document, not domain state.
6. Responsive server/client markup mismatches cause hydration failures; keep the first render consistent.
7. Treat MUI `useMediaQuery` as SSR-sensitive when it changes rendered structure.
8. Keep `nodeTypes` and `edgeTypes` stable rather than recreating their definitions during render.
9. React list keys must use stable IDs, not visible labels or array positions when items can change.
10. Responsive design is not desktop UI compressed into a smaller viewport; preserve canvas priority and provide usable mobile composition.
