# UML Editor Patterns

Patterns in this file keep the UML editor feeling like a Blueprint Workbench rather than a generic dashboard, MUI demo, or traditional generic UML editor.

## AppBar

Purpose: slim application chrome for orientation and global editor actions.

Desktop:

- Show breadcrumb or location context when space allows.
- Show project/editor title clearly.
- Keep Undo, Redo, and Auto Layout reachable.
- Avoid large promotional headers and oversized buttons.

Compact:

- Show Menu, truncated title, Undo, Redo, Layout, and Inspector.
- Use `minWidth: 0` and ellipsis for text.
- Do not let action buttons overflow the viewport.

## Model Rail

Purpose: project/model explorer, not a statistic card.

Desktop:

- Docked, narrow enough to preserve canvas dominance.
- Prioritize MODEL, Classes, Enums, Relationships.
- Counts are metadata secondary.
- DEMO/local state is a small indicator, not a permanent large alert.

Tablet/mobile:

- Drawer or overlay.
- Opening/closing must not mutate `DiagramLayout`.

## Toolbox

Purpose: modeling tools.

The toolbox should become a bottom Tool Dock in the Blueprint Workbench signature. It should not remain a vertical button column on desktop.

Desktop:

- Bottom-center horizontal Tool Dock inside the canvas.
- Group actions: Select, Class/Enum, Relation menu, Layout.
- Relationship choices may live in a menu/popover: Association, Aggregation, Composition, Generalization.
- Active tool is visually clear.
- Grouping is allowed when it improves scanning.

Tablet/mobile:

- Bottom compact toolbar with controlled overflow/menu.
- Controlled horizontal scroll is acceptable when intentional.
- Do not show a narrow vertical panel over the middle of the canvas.

## Canvas

Purpose: main modeling surface.

- The canvas must occupy the largest useful area of the viewport and feel like a light drafting surface.
- Use subtle grid/dot-grid cues with `Canvas` and `Grid` tokens.
- Floating controls must not hide the model unnecessarily.
- React Flow must mount in a reliably dimensioned parent.
- Pan/zoom/fitView are viewport behavior only and must not mutate `DiagramLayout`.

## UML Nodes

Purpose: readable class/enumeration representation.

- Use low-radius technical nodes with type markers, clear compartments, and monospace member rows.
- Selection uses Signal cyan; warning/error are small semantic markers.
- Nodes should not look like generic dashboard cards.

## Relationship Edges

Purpose: communicate UML relationship semantics.

- Association, aggregation, composition, and generalization should remain distinguishable without arbitrary per-type color noise.
- Multiplicity labels should look like small technical tags using monospace.
- Edge styling should remain restrained and technical.

## Selection State

Purpose: show what the inspector refers to.

- Selected node/edge should be visually obvious.
- StatusBar and Inspector should reflect selection.
- Do not rely only on subtle color changes with poor contrast.

## Relationship Creation State

Purpose: guide source-to-target relation creation.

Flow:

- Tool chosen.
- User selects source class.
- UI clearly says source is chosen and asks for target.
- User selects target class.
- One UML command executes.
- Draft clears.

Use source highlight, clear overlay text, and cancel affordance. Do not modify the model until target completion.

## Inspector

Purpose: context-specific editing.

The inspector should feel like a property sheet, not a SaaS form pile.

Expected sections when applicable:

- General.
- Attributes.
- Operations.
- Relationships.
- Diagnostics.

Desktop:

- Docked right panel with enough width for fields.
- Internal vertical scroll if content exceeds height.
- Avoid horizontal overflow.

Mobile/tablet:

- Drawer/overlay.
- Preserve field usability; do not compress attribute controls back into unreadable rows.

## Diagnostics

Purpose: validation awareness and navigation.

- Integrate with editor hierarchy.
- Use semantic warning/error colors.
- Make diagnostics navigable when they reference an element.
- Do not make diagnostics visually louder than the canvas unless blocking.

## Status Bar

Purpose: low-height IDE-like operational feedback.

Desktop:

- Revision.
- DEMO/local state.
- Error/warning counts.
- Selection summary.

Compact:

- Reduce secondary information.
- Prefer visible names over long IDs.
- Truncate safely.
- Never create horizontal page overflow.

## Empty States

Purpose: guide next action.

- Empty inspector should explain what to select.
- Empty canvas should suggest creating a class/enum when applicable.
- Avoid generic empty dashboard cards.

## Drawers

Purpose: preserve canvas space on smaller screens.

- Sidebar and inspector should become overlays on compact screens.
- Drawer open/close should not change model coordinates or `DiagramLayout`.
- Refit viewport visually if needed, without domain mutation.

## Mobile And Tablet

Responsive is required.

- Desktop: sidebar + toolbox + canvas + inspector can coexist.
- Tablet: canvas priority; secondary panels collapse or overlay.
- Mobile: compact app bar, horizontal tooling, canvas priority, drawers, reduced status, hidden minimap.
