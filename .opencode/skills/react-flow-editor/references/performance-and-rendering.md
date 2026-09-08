# Performance And Rendering

- Keep `nodeTypes` and `edgeTypes` stable; declare static maps outside render.
- Keep projection inputs deliberate and output stable when the document did not change.
- Scope effects to external synchronization. Do not use effects to create duplicate flow/store state.
- Do not run `fitView` on every render. Key it to meaningful readiness, container, layout, or breakpoint changes.
- Resize observers should compare dimensions before writing state and must not cause unbounded measurement/write cycles.
- Avoid mounting and unmounting the canvas for normal responsive transitions.
- Treat `Maximum update depth exceeded`, hydration errors, and React Flow warnings as regressions, not messages to suppress.
- Avoid unnecessary writes to either Zustand or React Flow internal state during drag, selection, pan, and zoom.

For broader component, effect, hydration, and rendering guidance, use `react-next-best-practices`; this reference only covers the React Flow boundary.
