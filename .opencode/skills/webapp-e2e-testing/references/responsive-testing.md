# Responsive Testing

Responsive behavior is an acceptance criterion whenever UI structure, controls, or the editor canvas change by viewport.

## Required Viewports

Test representative desktop, tablet, and mobile viewports. Use the project's actual breakpoints when they exist; otherwise select representative widths and report them.

For a viewport-sensitive change, test the transition sequence:

`desktop -> mobile -> tablet -> desktop`

This catches stale measurements, conditional-rendering defects, and state that only fails after resizing.

## Checks At Every Relevant Viewport

- No horizontal page overflow.
- Primary controls remain visible, reachable, and keyboard accessible.
- Drawers open, close, restore focus appropriately, and do not obscure essential controls without an alternative path.
- The canvas has non-zero usable dimensions and supports its intended pan, zoom, selection, or editing interactions.
- Focus remains visible and coherent after opening overlays and changing viewport.
- Browser console and page errors remain free of scenario-blocking regressions.
- The layout remains stable after loading, interaction, and resizing.

## React Flow Constraint

Viewport changes may adjust the visual container, fit behavior, zoom constraints, or panel composition. Responsive behavior must not modify `DiagramLayout` unless an explicit domain action requests a layout mutation.
