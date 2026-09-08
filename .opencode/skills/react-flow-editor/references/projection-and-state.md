# Projection And State

- Keep projection pure: read a `ProjectDocument`, selection, and diagnostics; return flow nodes and edges without mutating the document.
- Preserve stable IDs for UML elements, relationship edges, and React keys. Visible text is not an ID.
- Do not retain independently editable `Node[]` or `Edge[]`; derive them from the render snapshot.
- Preserve references when inputs have not changed. Memoize a projection only when it avoids real repeated work, not by default.
- Define `nodeTypes` and `edgeTypes` outside render, or memoize when genuinely dynamic. Keep React Flow callbacks stable when passed as props.
- Keep selection, active tool, relation draft, drawer state, and viewport UI state separate from UML semantics.

## Zustand Contract

- `currentDocument` is the render snapshot.
- `UmlHistory` is the editable, controlled holder.
- Execute commands, then synchronize the snapshot and diagnostics once.
- Guard selections and store writes for equality. Avoid store -> render -> effect -> store cycles and redundant writes.
- Do not mirror a React Flow selection into domain state unless an explicit UI selection mapping requires it.
