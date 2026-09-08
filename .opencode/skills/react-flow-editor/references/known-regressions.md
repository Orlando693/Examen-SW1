# Known Regressions From CU-02

These are reusable guardrails, not permanent implementation recipes.

- `Maximum update depth exceeded`: avoid cyclic selection/store/measurement effects; guard no-op writes.
- React Flow #004: give the direct parent real dimensions; verify flex/grid min sizes, hydration timing, and actual DOM measurement.
- `ResizeObserver`: compare measurements before state writes and disconnect cleanly to prevent loops.
- Responsive hydration: server/client breakpoint-dependent structure and MUI `useMediaQuery` can mismatch. Preserve deterministic initial markup.
- Mobile `fitView`: apply a legible minimum zoom and avoid repeated refits.
- Enum literal keys: use `literal.id`, not the visible name, to prevent duplicate keys.
- `nodeTypes` and `edgeTypes`: retain stable maps to prevent warnings and excess renders.
- Relation mode: source/target capture must take precedence over normal selection; do not let selection callbacks cancel or corrupt the draft.
- Relationship projection: preserve canonical `source`, `target`, and `kind`; do not invent them in the edge renderer.
- Prefer a single React Flow instance for one canvas across responsive states.
- A successful `GET /editor` is not browser acceptance; verify DOM, interactions, hydration, and console.
