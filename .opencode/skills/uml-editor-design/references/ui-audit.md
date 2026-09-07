# Current CU-02 UI Audit

This audit describes the current visual state of CU-02 after functional stabilization and the first design-system pass. It guides the Blueprint Workbench refinement.

## Current Strengths

- The editor has the required regions: AppBar, model rail/sidebar, toolbox, canvas, inspector, diagnostics, and status bar.
- React Flow now has a dedicated dimensioned host wrapper for the canvas.
- The model is visible and remains the main interactive surface.
- Relationship creation has explicit source/target feedback.
- The inspector supports class, enum, attribute, type, relationship, and multiplicity edits.
- Compact mode uses Drawers for sidebar and inspector.

## Current Visual Risks

- The interface still risks reading as generic MUI/editor UI if composition does not change.
- The toolbox must move away from the desktop vertical button stack and become a bottom Tool Dock.
- The hierarchy between sidebar, toolbox, canvas, inspector, diagnostics, and status bar can be more disciplined.
- The inspector empty state is functional but has room to feel more contextual and editor-specific.
- The canvas should remain visually dominant as future panels/features are added.
- Active states must stay consistent across toolbox, canvas selection, relation draft, diagnostics, and inspector.
- Avoid introducing accent colors outside the technical blue/semantic palette.
- Diagnostics should integrate into the editor workflow without becoming a separate dashboard widget.
- Responsive layouts should preserve the same editor language instead of becoming a squeezed desktop UI.
- Future visual changes should make the product feel like Blueprint Workbench: model rail, dominant drafting canvas, bottom Tool Dock, property sheet inspector, and IDE status bar.

## Known Constraints

- Do not change domain architecture for visual polish.
- Do not add a new component library.
- Do not hide React Flow warnings.
- Do not implement CU-03 persistence or future features while refining CU-02 visuals.
- The current UI still requires user-side manual browser validation before CU-02 acceptance.
