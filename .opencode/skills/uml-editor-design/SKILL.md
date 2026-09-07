---
name: uml-editor-design
description: Use when designing, redesigning, refining, critiquing, making responsive, changing layout, or changing visual components of the UML workspace/editor so it stays a professional technical modeling editor instead of a generic SaaS dashboard.
---

# UML Editor Design

Use this skill before visual design work on the UML editor workspace, including layout, responsive behavior, canvas composition, toolbar/toolbox changes, inspector changes, diagnostics presentation, node/edge styling, status feedback, or visual critique.

Do not use this skill for backend work, persistence, `@examen-sw1/uml-core` domain changes, command-bus behavior, generation, AI, voice, vision, XMI, Flutter, or AWS work unless the task also changes the UML editor UI.

## Design Intent

The editor must feel like a Blueprint Workbench: a professional technical modeling workbench built specifically for software modeling.

It must not feel like a generic admin dashboard, marketing landing page, average SaaS CRUD screen, MUI demo, or traditional generic UML editor.

Conceptual references:

- CAD/drafting workspaces.
- Technical IDE workspaces.
- Professional canvas tools.
- Diagramming and modeling tools.

Do not copy a specific product's look. Use these references only as conceptual analogies for hierarchy, density, chrome restraint, and interaction clarity.

## Non-Negotiable Project Constraints

Preserve existing project decisions:

- Next.js App Router.
- TypeScript.
- Material UI.
- React Flow.
- Zustand.
- `@examen-sw1/uml-core`.
- `UmlHistory` as editable domain holder.
- `currentDocument` as render snapshot.
- `UmlCommandBus` / `UmlHistory.execute()` for mutations.
- `ProjectDocument.model` as semantic source of truth.
- `ProjectDocument.layout` as visual layout state.

Never modify the canonical domain model to solve aesthetics.

Never introduce a second component library for visual polish.

Never implement future-CU scope while refining the editor UI.

Never hide React Flow warnings as a design solution.

## Required References

Before significant design work, read:

- `references/design-system.md`
- `references/editor-patterns.md`
- `references/ui-audit.md`
- `docs/product/product-01-next-nestjs.md`
- `docs/STATUS.md`
- Current editor components under `frontend/components/editor/`

## Required Design Brief

Before a relevant redesign or visual refactor, write a short design brief in the working response or implementation notes.

Include:

- Purpose
- Audience
- Visual direction
- Reference
- Palette
- Typography
- Density
- Memorable interaction
- Restraint

Default brief for this project:

- Purpose: Editor web tecnico para modelar UML visualmente.
- Audience: Estudiantes/desarrolladores trabajando principalmente en desktop, con soporte tablet/mobile secundario.
- Visual direction: Blueprint Workbench.
- Reference: CAD/drafting workspaces, technical IDEs, and professional canvas tools.
- Palette: Ink `#0B1F33`, Primary `#164E72`, Signal `#22A7B8`, Canvas `#F3F7F9`, Panel `#F8FAFB`, Grid `#D8E2E8`, Border `#C8D3DA`, semantic warning/error only.
- Typography: Material UI defaults for UI roles, system monospace for model members, multiplicities, and technical metadata.
- Density: Dense enough for technical work, still breathable.
- Memorable interaction: Bottom Tool Dock relation mode with clear choose-source and choose-target feedback.
- Restraint: No decorative gradients, no glassmorphism, no arbitrary purple SaaS accents, no card overload, no landing-page layout.

## Required Workflow

1. Read project context.
2. Read `references/design-system.md`.
3. Read `references/editor-patterns.md`.
4. Review the current UI implementation.
5. Write the short design brief.
6. Propose a wireframe/layout direction.
7. Identify what will be preserved.
8. Identify what will change.
9. Define or reuse tokens before changing components.
10. Implement the smallest correct visual changes.
11. Run relevant tests.
12. Render or open the UI when possible.
13. Review visually.
14. Correct responsive behavior.
15. Confirm previous functionality did not regress.

Do not accept a design only because it compiles.

## Core Principles

### Blueprint Workbench

Preserve the signature identity: slim application chrome, model rail, dominant drafting canvas, bottom Tool Dock, contextual property sheet, and IDE-like status bar.

### Canvas First

The model is the protagonist. Navigation, panels, status bars, and controls support the canvas instead of competing with it.

### Contextual Inspector

The right panel changes according to selection. It should feel like a modeling inspector, not a generic form card.

### Compact Tooling

Tools should feel like editor tools. Avoid generic form-button stacks and dashboard action cards.

### Clear State

Selection, active tool, relation source, relation target expectation, errors, warnings, disabled controls, and transient command feedback must be visually unambiguous.

### Progressive Disclosure

Do not show everything permanently. Prefer panels, sections, drawers, or compact summaries when the canvas needs space.

## Responsive Requirement

Responsive behavior is an acceptance criterion, not a finishing detail.

- Desktop: model rail, dominant canvas, contextual property sheet, bottom Tool Dock, low-height status bar.
- Tablet: canvas prioritized, model rail/property sheet collapse or overlay, bottom Tool Dock adapts.
- Mobile: near full-screen canvas, compact bottom Tool Dock, drawers for model/inspector, hidden minimap, reduced status detail.

Do not compress the desktop UI until it becomes unreadable on mobile.

## Motion And Interaction

Use motion only to explain state changes:

- Hover.
- Focus.
- Selection.
- Tool activation.
- Relation source highlight.
- Drawer transition.
- Brief command feedback.

Respect `prefers-reduced-motion` when adding non-trivial motion.

Avoid decorative or heavy animation.

## Anti-Patterns

Avoid:

- Generic admin dashboard layout.
- Generic UML editor layout.
- MUI demo appearance.
- Purple SaaS accent colors without semantic purpose.
- Gradients used only for decoration.
- Glassmorphism.
- Huge landing-page whitespace.
- Universal large border radius.
- Everything inside cards.
- Pill buttons for every action.
- Toolbars that look like form submit areas.
- Inspector sections with no contextual hierarchy.
- Mobile UI that is just desktop squeezed smaller.
- Styling that hides runtime warnings or layout defects.
