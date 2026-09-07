# UML Editor Design System

This design system guides visual decisions for the CU-02 UML editor and later editor refinements. It is a project-local reference, not a new dependency or replacement for Material UI.

## Direction

Visual direction: Blueprint Workbench.

The editor should feel precise, structured, calm, and purpose-built for software modeling. It should combine drafting-surface discipline with IDE density and canvas-tool clarity.

## Color

Use the Blueprint Workbench palette with semantic warning/error colors. Avoid introducing unrelated accent colors without a defined role.

Conceptual tokens:

- Ink: `#0B1F33` for app chrome and strongest technical text.
- Primary: `#164E72` for primary editor chrome and structural emphasis.
- Signal: `#22A7B8` only for selection, active tool, handles, focus, and technical state highlights.
- Canvas: `#F3F7F9` for the drafting surface.
- Panel: `#F8FAFB` for model rail and property sheet surfaces.
- Grid: `#D8E2E8` for subtle canvas grid/drafting affordances.
- Border: `#C8D3DA` for structural separators.
- Text primary: Ink or near-ink.
- Text secondary: `#647580` for metadata and helper text.
- Warning: `#D97706` only for validation warnings.
- Error: `#C2413A` only for errors/destructive feedback.
- Disabled: low-contrast neutral with clear non-interactive state.

Do not use arbitrary purple accents for selected state. Use Signal for technical selection/focus states.

## Typography

Keep typography compatible with the existing Material UI setup.

Roles:

- Screen title: concise project/editor title, strong weight, truncates when needed.
- Section title: panel section labels such as General, Attributes, Relationships, Diagnostics.
- Body: readable form and inspector content.
- Metadata: smaller text for revision, demo/local state, counts, IDs when absolutely needed.
- Control labels: direct action language, sentence/title case consistent with Spanish UI copy.
- Technical model data: `ui-monospace`, `SFMono-Regular`, `Consolas`, or system monospace for attribute names, types, operation signatures, multiplicities, IDs, and compact metadata.

Avoid mixing many type sizes just to create visual interest. Hierarchy should come from role, not decoration.

## Density

The editor is technical software. Use workbench density: compact controls, low-height chrome, and breathable property sections.

Avoid landing-page scale spacing. Avoid cramming controls until labels truncate in normal desktop widths.

## Spacing

Use a small consistent scale:

- 4px: tight inline gaps.
- 8px: standard control gaps.
- 12px: compact panel padding or grouped controls.
- 16px: main panel padding and floating chrome offsets.
- 24px: larger section separation when needed.

Prefer consistent spacing over one-off margins.

## Radius

Use radius to express surface role:

- Small radius for controls and fields.
- Medium radius for floating toolbars/panels.
- Minimal/no radius for docked structural panels.

Do not apply one large radius everywhere.

## Shadow

Use shadows sparingly.

Prefer borders, background contrast, and z-index hierarchy first. Floating toolbox or transient overlays may use subtle elevation. Docked panels should usually use borders instead of shadows.

## Iconography

No new icon dependency is required for CU-02 design polish. Text labels are acceptable if precise and readable.

If icons are later introduced, they must support tool recognition and not replace required clarity.

## State Tokens

States must be visually distinct:

- Active tool: primary/selected treatment with clear affordance.
- Hover: subtle surface or border change.
- Focus: accessible focus ring.
- Selected node: clear blue outline/surface.
- Relation source: temporary highlight separate from normal selection when possible.
- Warning/error: semantic color only.
- Disabled: visibly muted and non-clickable.
