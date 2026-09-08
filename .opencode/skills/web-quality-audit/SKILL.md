---
name: web-quality-audit
description: Use when reviewing UI, UX, accessibility, responsive behavior, keyboard or focus handling, ARIA, forms, touch/mobile interaction, visual quality, or frontend acceptance readiness. Produces objective findings without automatically changing code for a review-only request.
---

# Web Quality Audit

Use this skill to evaluate implementation quality objectively. It complements `uml-editor-design`, which defines the Blueprint Workbench visual direction; it does not replace it or turn the editor into a generic SaaS dashboard.

## Required Reading

Read only the references relevant to the audit:

- `references/accessibility.md`
- `references/focus-keyboard.md`
- `references/responsive-touch.md`
- `references/forms-feedback.md`
- `references/motion-performance.md`
- `references/project-known-debt.md`
- `references/audit-output.md`

## Workflow

1. Identify user-facing flows and applicable quality categories.
2. Inspect code and, when browser-visible behavior matters, use `webapp-e2e-testing`.
3. Classify evidence as `BLOCKER`, `WARNING`, or `SUGGESTION`.
4. Report findings in the required output format and finish with acceptance readiness.

For a request explicitly framed as a review or audit, do not modify code automatically.

## Skill Boundaries

- UML visual direction: `uml-editor-design` + this skill.
- React/Next implementation: `react-next-best-practices`.
- React Flow canvas behavior: `react-flow-editor`.
- Real-browser evidence: `webapp-e2e-testing`.

## Sources And Attribution

This is an original Examen-SW1-specific adaptation informed by:

- https://github.com/vercel-labs/agent-skills
- https://github.com/vercel-labs/web-interface-guidelines
- https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

Both referenced Vercel repositories are MIT licensed. No large rule collection or source text was copied.
