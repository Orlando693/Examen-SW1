## 1. Increment 1 - Canonical Model Package

- [x] 1.1 Inspect the current worktree, confirm CU-00 is committed/pushed, and preserve existing `frontend/`, `backend/`, docs, OpenSpec, and OpenCode configuration.
- [x] 1.2 Add `packages/uml-core` to the root npm workspaces without moving `frontend/` or `backend/`.
- [x] 1.3 Create `packages/uml-core/package.json` with scripts for `build`, `lint`, `typecheck`, and `test`, using existing TypeScript, ESLint, and Vitest tooling patterns.
- [x] 1.4 Add `packages/uml-core` TypeScript, build, lint, and Vitest configuration with no runtime framework dependencies.
- [x] 1.5 Define shared ID utilities using UUID strings and `crypto.randomUUID()` while allowing explicit IDs in tests/factories.
- [x] 1.6 Define serializable `ProjectDocument` with metadata, optional conceptual `ownerId`, revision, timestamps, `model`, and `layout`.
- [x] 1.7 Define `CanonicalUmlModel`/`UmlModel` semantic types for packages, classes, attributes/properties, operations, enumerations, literals, relationships, visibility, UML type references, multiplicity, and generation metadata separated from UML pure data.
- [x] 1.8 Define `DiagramLayout` types containing only visual/positional information keyed by semantic element IDs.
- [x] 1.9 Add document/model factory helpers that create valid in-memory project documents without depending on frontend, backend, React Flow, or persistence.
- [x] 1.10 Add serialization/deserialization helpers for JSON-compatible project document round-trips.
- [x] 1.11 Add tests for project document creation, classes, attributes, operations, enumerations, representative relationships, model/layout separation, and serialization/deserialization round-trip.

## 2. Increment 2 - Reusable Validation Engine

- [x] 2.1 Define validation diagnostic types with `ERROR` and `WARNING` severities, code, message, logical path, and optional element reference.
- [x] 2.2 Define validation result API with diagnostics, errors, warnings, and blocking-error convenience fields.
- [x] 2.3 Implement a single `validateProjectDocument` entry point with an extensible internal rule list.
- [x] 2.4 Implement duplicate ID validation for semantic elements and layout entries where uniqueness is required.
- [x] 2.5 Implement missing reference validation for relationships and layout nodes.
- [x] 2.6 Implement multiplicity validation for malformed and internally inconsistent bounds.
- [x] 2.7 Implement malformed relationship validation for missing endpoints, self-generalization, and endpoint incompatibilities required by the initial model.
- [x] 2.8 Implement required-name/structure validation for packages, classes, enumerations, attributes, operations, literals, and relationships where applicable.
- [x] 2.9 Implement one non-blocking warning rule, such as class names not starting with an uppercase letter, without making style warnings block by default.
- [x] 2.10 Add validation tests for valid models, duplicate IDs, missing references, invalid multiplicities, malformed relationships, invalid names/structures, and ERROR/WARNING diagnostics.

## 3. Increment 3 - Command Bus, Undo/Redo, Verification, And Documentation

- [x] 3.1 Define typed `UmlCommand` discriminated unions for `CreateClass`, `DeleteClass`, `RenameClass`, `AddAttribute`, `RemoveAttribute`, `UpdateAttribute`, `CreateAssociation`, `UpdateMultiplicity`, and `MoveNode`.
- [x] 3.2 Define structured command result types for accepted commands, rejected commands, validation failures, diagnostics, and returned project documents.
- [x] 3.3 Implement deterministic command executors for the initial command families.
- [x] 3.4 Implement `UmlCommandBus` that resolves executors, applies commands through the command route, validates candidate documents when required, and avoids mutating caller-owned documents in place.
- [x] 3.5 Ensure `MoveNode` updates only `DiagramLayout` and leaves the semantic `UmlModel` unchanged.
- [x] 3.6 Implement snapshot-based local undo/redo history with configurable history limit and default limit of 100 operations.
- [x] 3.7 Implement redo clearing after executing a new accepted command following undo.
- [x] 3.8 Implement history limit enforcement by dropping the oldest undoable entries when the limit is exceeded.
- [x] 3.9 Add command bus tests for `CreateClass`, `RenameClass`, attribute commands, association commands, multiplicity updates, rejected invalid commands, and validation failure behavior.
- [x] 3.10 Add undo/redo tests for undo, redo, redo clearing after new command, history limit behavior, and deterministic document restoration.
- [x] 3.11 Export the public `uml-core` API from `packages/uml-core/src/index.ts` without exporting UI/backend-specific code.
- [x] 3.12 Update root global scripts and lockfile so `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build` include `packages/uml-core` along with existing workspaces.
- [x] 3.13 Run package-level `uml-core` checks: tests, typecheck, lint, and build.
- [x] 3.14 Run root global checks: `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 3.15 Create `docs/puds/use-cases/CU-01-canonical-uml-core.md` documenting objective, scope, architecture, package structure, domain model, ID/type/relationship decisions, validation rules, command design, undo/redo strategy, tests, errors, corrections, limitations, debt, and final result based on actual implementation.
- [x] 3.16 Update `docs/STATUS.md` and `docs/HANDOFF.md` to reflect CU-01 active state, OpenSpec, verification status, known issues, and next action.
- [x] 3.17 Verify `packages/uml-core` has no forbidden framework/runtime dependencies and no React Flow, frontend, backend, persistence, auth, collaboration, generation, AI, voice, Flutter, or AWS implementation.
- [x] 3.18 Run OpenSpec validation for `cu-01-canonical-uml-core` and address discrepancies before requesting user acceptance.

## 4. Verification Corrections

- [x] 4.1 Replace the Node-specific `node:crypto` UUID import with a framework-agnostic Web Crypto `globalThis.crypto.randomUUID()` strategy that remains compatible with Node.js 24 and modern browsers.
- [x] 4.2 Add positive tests for valid `aggregation` and valid `generalization` relationships while preserving existing association, composition, and invalid generalization coverage.
- [x] 4.3 Add a validation test that asserts the complete public `ValidationDiagnostic` shape for an error, including severity, code, message, path, and element reference.
- [x] 4.4 Add a defensive command bus test that forces an unknown runtime command by cast, verifies controlled rejection, and verifies the original `ProjectDocument` is unchanged without weakening production `UmlCommand` typing.
