---
name: react-next-best-practices
description: Use when writing, reviewing, debugging, or refactoring React, Next.js App Router, Server or Client Components, hooks, effects, Zustand, hydration, responsive React logic, frontend data fetching, rendering, or performance in this project.
---

# React And Next Best Practices

Use this skill for technical implementation quality in the project's Next.js frontend. Preserve the existing App Router structure and make the smallest correct change.

For browser-visible verification after a UI change, also use `webapp-e2e-testing`. For UML workspace visual direction, also use `uml-editor-design`.

## Required References

Read the relevant reference before changing frontend code:

- `references/next-app-router.md`
- `references/state-and-effects.md`
- `references/hydration-and-ssr.md` for SSR, responsive markup, or MUI changes
- `references/rendering-performance.md` for data fetching, bundle, or rendering work
- `references/project-regressions.md` for React Flow, Zustand, ResizeObserver, or responsive editor work

## Implementation Standard

1. Identify whether code belongs on the server or client boundary.
2. Keep client boundaries narrow and effects justified by synchronization with an external system.
3. Derive renderable values during render when possible; do not create effect-driven duplicate state.
4. Use stable identities for lists, store selectors, React Flow props, and dependencies.
5. Treat hydration warnings, update loops, and React Flow errors as defects to investigate, not warnings to suppress.

## Project Constraints

- Preserve `frontend/app/`; do not migrate it to `frontend/src/app/`.
- Keep React Flow as a projection of `ProjectDocument`; it is not the persisted domain.
- Keep semantic UML state separate from visual `DiagramLayout` and UI-only state.
- Do not add dependencies or broad abstractions unless the active task has a concrete need.

## Attribution

This local skill is an original, project-specific adaptation of concepts from Vercel Labs' React Best Practices skill:

- https://github.com/vercel-labs/agent-skills
- https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices

The referenced Vercel repository is MIT licensed. No large text blocks or rule collection were copied.
