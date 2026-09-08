---
name: react-flow-editor
description: Use when implementing, reviewing, debugging, or testing React Flow/@xyflow/react, the UML canvas, custom nodes or edges, handles, relationships, viewport, fitView, dragging, DiagramLayout, ELK, ResizeObserver, responsive canvas, canvas performance, or future realtime canvas collaboration.
---

# React Flow Editor

Use this skill for React Flow-specific work in the UML editor. It is especially relevant to CU-05 and any change under `frontend/components/editor/` or `frontend/lib/editor/` that affects the canvas.

## Required Reading

Read the relevant references before editing:

- `references/architecture-contract.md`
- `references/projection-and-state.md`
- `references/viewport-and-layout.md`
- `references/nodes-edges-handles.md`
- `references/performance-and-rendering.md`
- `references/testing.md`
- `references/known-regressions.md`

Confirm the installed `@xyflow/react` version before proposing API-specific changes. The current project baseline is `12.11.6`.

## Non-Negotiable Contract

```text
ProjectDocument.model + ProjectDocument.layout
  -> projection adapter -> React Flow nodes / edges

UI intent -> UmlCommand -> UmlCommandBus / UmlHistory
  -> ProjectDocument -> projection -> React Flow
```

`CanonicalUmlModel` / `ProjectDocument` is the semantic source of truth. React Flow is a visual projection, never a second UML model or persisted domain.

## Scope Boundaries

- Use `react-next-best-practices` for general React, Next.js, Zustand, SSR, and hydration implementation guidance.
- Use `uml-editor-design` for Blueprint Workbench visual direction.
- Load `webapp-e2e-testing` for browser-visible behavior, console checks, responsive canvas, or manual acceptance.
- Do not introduce a parallel mutation path for React Flow, ELK, collaboration, AI, voice, or import.

## Sources And Attribution

This is an original project-specific adaptation. It audits concepts from:

- Official React Flow documentation: https://reactflow.dev/
- `oil-oil/react-flow-advanced-best-practices`: https://github.com/oil-oil/react-flow-advanced-best-practices

The third-party repository is MIT licensed. Official React Flow documentation is the API source of truth. No large text blocks, scripts, or implementation code were copied.
