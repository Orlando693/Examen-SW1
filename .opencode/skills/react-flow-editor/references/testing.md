# Testing

## Unit And Component

Cover the projection adapter and command/store boundary:

- classes, enums, diagnostics, relationship kinds, endpoint direction, multiplicities, source, and target;
- stable IDs and custom node/edge type names;
- `MoveNode` updates `DiagramLayout` through the command path;
- ELK output becomes `ApplyLayout` and no direct domain mutation occurs;
- selection/store synchronization avoids redundant writes and preserves `currentDocument` as a history snapshot.

## Browser

Load `webapp-e2e-testing` and verify in a real browser:

- canvas and nodes are visible after hydration;
- drag, pan, zoom, fit, relationship selection/creation, and edge rendering work;
- desktop, tablet, mobile, and transitions remain usable;
- console has no hydration mismatch, #004, update-depth, missing-handle, or custom-type warnings;
- viewport actions do not alter logical layout except explicit drag or auto-layout commands.

An HTTP `200` for `/editor` does not prove React Flow works.
