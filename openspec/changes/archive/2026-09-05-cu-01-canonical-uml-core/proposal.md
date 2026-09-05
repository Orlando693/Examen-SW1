## Why

CU-01 establishes the framework-agnostic UML domain core required before any visual editor, persistence, collaboration, generation, or assistant work can be safely implemented. The project already has an executable frontend/backend foundation from CU-00, but it does not yet have a canonical model, validation engine, command route, or undo/redo mechanism.

## What Changes

- Add a shared root workspace package at `packages/uml-core/` for reusable UML domain code.
- Extend the root npm workspace configuration and global quality commands so `packages/uml-core` participates in install, test, typecheck, lint, and build workflows.
- Define `ProjectDocument` with explicit separation between semantic `UmlModel` and visual-only `DiagramLayout`.
- Define a `CanonicalUmlModel`/`UmlModel` supporting the initial UML subset: classes, attributes/properties, operations, enumerations, visibility, data types, associations, aggregation, composition, generalization, multiplicity, packages where needed, and generation metadata separated from UML semantics.
- Define stable UUID-based identifiers and serializable/deserializable plain data structures independent of React Flow or any UI framework.
- Add a single reusable validation engine producing structured diagnostics with `ERROR` and `WARNING` severities, logical paths, codes, messages, and element references when applicable.
- Add a typed `UmlCommand` language, `UmlCommandBus`, and command executors for deterministic mutations through the command route only.
- Add local undo/redo with configurable history limit, initial default of 100 operations, redo clearing after new commands, and deterministic tests.
- Keep frontend and backend application folders unchanged at root and do not introduce CU-02 or later capabilities.

## Capabilities

### New Capabilities

- `canonical-uml-core`: Defines the framework-agnostic UML domain package, canonical project/model/layout structures, validation diagnostics, typed command execution, and local undo/redo behavior.

### Modified Capabilities

- `project-foundation`: Root workspace and global quality command requirements are expanded to include the shared `packages/uml-core` workspace in addition to `frontend` and `backend`.

## Impact

- Affected project areas: root `package.json`, `package-lock.json`, new `packages/uml-core/`, documentation for CU-01, `docs/STATUS.md`, and `docs/HANDOFF.md`.
- Existing CU-00 frontend/backend behavior must remain intact and checks must stay green.
- No new UI, React Flow, Zustand, ELK.js, NestJS, Fastify, Prisma, PostgreSQL, Socket.IO, auth, generation, AI, voice, Flutter, AWS, or database dependency is introduced for `uml-core`.
- The `uml-core` package may use existing TypeScript/Vitest/ESLint tooling, but must remain runtime framework-agnostic and reusable by future frontend/backend consumers.
