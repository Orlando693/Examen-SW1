# Motion And Performance

- Honor `prefers-reduced-motion` for non-trivial motion.
- Animate only to clarify state, causality, or navigation. Avoid decorative animation in the workbench.
- Prefer compositor-friendly `transform` and `opacity`; never use `transition: all`.
- Batch DOM reads/writes and avoid layout thrashing, especially around measurement, drawers, and the canvas.
- Reserve image/media space and use appropriate assets. Do not add decorative media to the UML workspace.
- Profile rendering cost when a regression is observable; do not duplicate general React performance guidance from `react-next-best-practices` or React Flow guidance from `react-flow-editor`.
