# Nodes, Edges, And Handles

- Custom node and edge type names must exactly match their `nodeTypes` / `edgeTypes` keys.
- Edges require valid stable `source` and `target` node IDs. Preserve UML relationship `kind`, endpoint direction, multiplicities, and labels in projection data.
- Model UML arrowheads and diamonds as rendering details; do not infer UML semantics from React Flow marker internals.
- Use `sourceHandle` and `targetHandle` with stable handle IDs when a node has multiple handles of the same type.
- A `Handle` belongs inside a custom node. Keep handles measurable: do not use `display: none`; use `visibility: hidden` or `opacity: 0` when hiding is necessary.
- Call `useUpdateNodeInternals` only when handles are added, removed, repositioned, or otherwise dynamically changed after React Flow has measured them.
- Custom edges must use the supplied source/target coordinates and positions when creating paths. Keep edge labels accessible and prevent their interaction layer from blocking unrelated canvas input.
- React keys for literals, attributes, and members must be canonical IDs, never duplicate display names.
