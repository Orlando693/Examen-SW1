# Viewport And Layout

`DiagramLayout` contains logical node positions and optional sizes that may be persisted. The React Flow viewport contains transient pan, zoom, and `fitView` presentation.

- `fitView` must not modify `DiagramLayout`.
- Container resize and breakpoint changes must not modify `DiagramLayout`.
- `ApplyLayout` may modify `DiagramLayout` through the command route.
- Mount a flow only after its direct parent has real non-zero width and height. React Flow warning #004 means the sizing chain needs investigation.
- In flex/grid layouts, use explicit sizing plus `minWidth: 0` and `minHeight: 0` where shrinking is required.
- Use `ResizeObserver` only for measured presentation work. Round/compare dimensions and avoid redundant state writes or observer-triggered resize loops.
- Keep hydration markup deterministic. Do not let server/client breakpoint divergence mount different canvas structures before hydration is settled.
- Keep one `ReactFlow` instance for a canvas when possible; do not swap it by breakpoint.
- Responsive canvas behavior prioritizes readable mobile zoom and usable pan. Do not fit so aggressively that the diagram becomes illegible.

React Flow requires its parent to have dimensions and its stylesheet to be loaded. See https://reactflow.dev/learn/troubleshooting/common-errors.
