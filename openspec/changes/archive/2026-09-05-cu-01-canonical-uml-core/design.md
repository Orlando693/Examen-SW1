## Context

See `proposal.md` for motivation. CU-00 completed the executable frontend/backend foundation and archived the `project-foundation` spec. CU-01 must add the UML domain core before any canvas, persistence, collaboration, generation, or assistant work.

The core must live in `packages/uml-core/`, participate in npm workspaces, and remain framework-agnostic. It must not depend on Next.js, React, Material UI, React Flow, NestJS, Fastify, Prisma, PostgreSQL, Socket.IO, or other future-CU frameworks.

## Goals / Non-Goals

**Goals:**

- Add `packages/uml-core` as a first-class npm workspace with build, lint, typecheck, and Vitest test scripts.
- Define serializable TypeScript domain types for `ProjectDocument`, `CanonicalUmlModel`/`UmlModel`, and `DiagramLayout`.
- Keep semantic UML data and visual layout data physically separate in the document shape.
- Provide deterministic helpers for creating, cloning, serializing, and deserializing project documents.
- Provide a single validation API and initial invariant rules with structured diagnostics.
- Provide typed UML commands, a command bus, command executors, structured command results, and validation integration.
- Provide local undo/redo with a configurable history limit and default limit of 100 operations.
- Prove behavior through package-level Vitest tests and root global checks.

**Non-Goals:**

- No React Flow projection, visual workspace, Material UI workspace components, inspector, toolbox, ELK layout, or frontend integration.
- No backend API integration, persistence, Prisma, PostgreSQL, authentication, ownership enforcement, Socket.IO, realtime collaboration, or distributed undo/redo.
- No relational mapping, Spring Boot generation, generated OpenAPI, Postman, Domain Manifest, AI, voice, image import, Flutter, or AWS.
- No full UML 2.5.1 implementation; CU-01 implements the initial subset and core invariants only.

## Decisions

### 1. Internal package structure

`packages/uml-core/` will use a small source layout organized by responsibility:

```text
packages/uml-core/
├── src/
│   ├── index.ts
│   ├── ids.ts
│   ├── model/
│   │   ├── document.ts
│   │   ├── layout.ts
│   │   ├── model.ts
│   │   ├── relationships.ts
│   │   └── types.ts
│   ├── serialization/
│   │   └── serialization.ts
│   ├── validation/
│   │   ├── diagnostics.ts
│   │   ├── rules.ts
│   │   └── validate.ts
│   ├── commands/
│   │   ├── command-bus.ts
│   │   ├── commands.ts
│   │   ├── executors.ts
│   │   └── results.ts
│   └── history/
│       └── uml-history.ts
├── test/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.js
└── vitest.config.ts
```

Rationale: this keeps model, validation, commands, and history independent but close enough for a small package.

Alternatives considered:

- Single large `src/index.ts`: rejected because command/validation/history concerns would become hard to review.
- Separate packages for model, validation, commands, and history: rejected for CU-01 because it adds workspace overhead before there are external consumers.

### 2. Concrete canonical model shape

The canonical document will be plain data, not class instances:

```text
ProjectDocument
├── id: Uuid
├── metadata
├── ownerId?: Uuid
├── revision: number
├── timestamps
├── model: CanonicalUmlModel
└── layout: DiagramLayout
```

`CanonicalUmlModel` and `UmlModel` will be aliases or equivalent exported concepts for the semantic model. The implementation should export both names if that improves readability and compatibility with product language, while keeping one concrete shape.

The model will contain arrays of semantic elements:

- `packages: UmlPackage[]`
- `classes: UmlClass[]`
- `enumerations: UmlEnumeration[]`
- `relationships: UmlRelationship[]`

Rationale: arrays are JSON-friendly, deterministic to serialize, simple to test, and easy to validate for duplicate IDs. Index maps can be derived when needed instead of persisted.

Alternatives considered:

- Maps keyed by ID: rejected for persisted shape because JSON round-trips are less direct and ordering is less explicit.
- Class-based domain objects: rejected because they complicate serialization and framework-independent reuse.

### 3. Separation of UML pure data and generation metadata

Pure UML fields will remain directly on UML entities. Generation-specific information will live under an optional `generation` object on model elements, for example `generation?: GenerationMetadata`.

Initial metadata should be deliberately small and declarative, allowing flags such as entity/readOnly/searchable/crud/required/unique/sortable/defaultSort when needed by later CUs, but CU-01 should not implement relational mapping or generator rules.

Rationale: product.md requires distinguishing UML pure elements from generator metadata. A nested object keeps the distinction visible without needing a second model now.

Alternatives considered:

- Mixing generation flags directly into UML attributes/classes: rejected because it blurs semantic boundaries.
- Separate generation profile registry: deferred because it belongs closer to generation CUs.

### 4. ID strategy

Every project, package, class, enumeration, attribute, operation, literal, relationship, and layout node will have a stable UUID string branded or aliased as `Uuid`.

Generation will use the built-in `crypto.randomUUID()` available in Node.js 24 and modern browsers. Tests may pass explicit IDs to keep assertions deterministic.

Rationale: no runtime dependency is needed and UUID is required conceptually by product.md.

Alternatives considered:

- Add `uuid` npm package: rejected because Node.js 24 already provides UUID generation.
- Sequential IDs: rejected because future collaboration/import/persistence need globally stable IDs.

### 5. Relationships and multiplicities

Relationships will use a discriminated union or equivalent `kind` field:

- `association`
- `aggregation`
- `composition`
- `generalization`

Association-like relationships will have `source` and `target` endpoints referencing class IDs and optional role/multiplicity. Aggregation and composition will use the same endpoint structure plus `kind` to distinguish semantics. Generalization will reference subclass/source and superclass/target class IDs and will not require multiplicity.

Multiplicity will be a structured value with lower and upper bounds. Upper can be a non-negative integer or `*`. Lower must be a non-negative integer and must not exceed a numeric upper.

Rationale: endpoint references and structured multiplicity are testable and prevent parsing multiplicity strings throughout the system.

Alternatives considered:

- Store UML multiplicity as free-form strings only: rejected because validation and generation need deterministic bounds.
- Separate relationship types with incompatible shapes: rejected because initial commands and tests would duplicate endpoint handling.

### 6. Type representation

Attribute and operation types will use a small structured `UmlTypeRef`:

- primitive types by name, such as `string`, `number`, `boolean`, `date`, `datetime`, `void`
- class references by ID
- enumeration references by ID
- custom named types for cases not yet modeled

Rationale: this supports product-required data types and future class/enum references without requiring a full type system in CU-01.

Alternatives considered:

- Plain string types only: rejected because enum/class references become ambiguous.
- Full UML type hierarchy: rejected as too broad for CU-01.

### 7. Validation API and diagnostics

The main validation entry point will be a function equivalent to:

```text
validateProjectDocument(document, options?) -> ValidationResult
```

Diagnostics will include:

- `severity: 'ERROR' | 'WARNING'`
- `code: string`
- `message: string`
- `path: string`
- `elementId?: Uuid`
- `elementType?: string`

`ValidationResult` will expose `diagnostics`, `errors`, `warnings`, and `hasErrors` or equivalent convenience fields.

Initial rules:

- duplicate element IDs across semantic elements where uniqueness is required;
- empty or invalid required names for packages, classes, enumerations, attributes, operations, literals, and relationships where applicable;
- relationships referencing missing classes;
- layout entries referencing missing semantic elements;
- malformed association/aggregation/composition endpoints;
- generalization endpoints that are missing or self-referential;
- invalid multiplicities;
- warning for class names that do not start with an uppercase letter, as a non-blocking demonstrative rule.

Rationale: these rules prove the reusable engine and cover essential invariants without claiming full UML compliance.

Alternatives considered:

- No warning rule: rejected because CU-01 explicitly needs ERROR and WARNING diagnostics.
- Many UML style rules: rejected because they would invent unnecessary constraints.

### 8. UmlCommand contract

Commands will be TypeScript discriminated unions with stable `type` names and payloads. Initial command names:

- `CreateClass`
- `DeleteClass`
- `RenameClass`
- `AddAttribute`
- `RemoveAttribute`
- `UpdateAttribute`
- `CreateAssociation`
- `UpdateMultiplicity`
- `MoveNode`

Additional minimal commands may be introduced only if required to test model support, such as creating an enumeration, but implementation should prefer direct document factories for non-mutating setup where possible.

Rationale: discriminated unions provide exhaustive compile-time handling and map cleanly to future UI, collaboration, assistant, and import adapters.

Alternatives considered:

- String command names with untyped payloads: rejected because invalid command shapes would move failures to runtime.
- One generic update command: rejected because it weakens validation and future auditability.

### 9. Command execution strategy

`UmlCommandBus` will resolve commands to deterministic executors. Each execution will:

1. receive the current `ProjectDocument` and a typed command;
2. verify command preconditions and references;
3. produce a candidate next document;
4. run validation when configured or required;
5. return a structured result containing success/failure, document, diagnostics, and error information.

The bus should not mutate the caller's document in place. Callers receive the accepted next document and must replace their reference.

Rationale: this enforces the conceptual path `adapter -> UmlCommand -> UmlCommandBus -> UmlCommandExecutor -> ProjectDocument` while staying framework-agnostic.

Alternatives considered:

- Mutating the document in place: rejected because undo/redo and tests become more error-prone.
- Global singleton command bus: rejected because future tests and consumers need isolated instances/configuration.

### 10. Undo/Redo strategy

Undo/redo will use immutable snapshots of `ProjectDocument` before and after accepted commands. The history manager will keep:

- current document;
- undo stack entries with before/after snapshots and command metadata;
- redo stack entries;
- configurable `historyLimit`, default `100`.

Accepted new commands push an undo entry and clear redo. Undo restores the previous snapshot and moves the entry to redo. Redo restores the after snapshot and moves the entry back to undo. When the history limit is exceeded, the oldest undo entries are dropped.

Rationale: snapshots are easiest to reason about in CU-01, deterministic, and safe before collaboration/persistence complexity exists. Project documents are expected to be small in the initial in-memory editor phase.

Alternatives considered:

- Compensating commands: rejected for CU-01 because every command would require an inverse and complex edge cases for deletes/relationships.
- Operation log only: rejected because redo/undo correctness would depend on replay logic not needed yet.

### 11. Immutability and mutation control

The package will use immutable-return style: command executors create cloned next documents rather than mutating caller-owned objects. Internal implementation can use local mutable copies for simplicity, but externally visible APIs return new document references.

Rationale: this makes command results, validation, and snapshots predictable without adding an immutability library.

Alternatives considered:

- Deep freeze every document: rejected because it adds runtime overhead and test noise.
- Allow external mutation: rejected because it violates the command-route goal.

### 12. Testing strategy

Vitest tests will be package-local under `packages/uml-core/test/` or colocated where clearer. Tests should cover behavior listed in the CU request and specs:

- project document creation;
- classes, attributes, operations, enums, representative relationships;
- semantic/layout separation;
- serialization/deserialization round-trip;
- invalid references, duplicate IDs, invalid multiplicity, malformed relationships;
- ERROR and WARNING diagnostics;
- command bus execution for initial command families;
- `MoveNode` changing layout only;
- undo, redo, redo clearing, and history limit.

Root `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build` must include `uml-core` and preserve existing frontend/backend checks.

## Risks / Trade-offs

- [Risk] Snapshot-based history can grow memory usage with large documents. -> Mitigation: keep default history limit at 100, make it configurable, and revisit in collaboration/persistence CUs if model size requires optimization.
- [Risk] Plain arrays require repeated lookup/index building. -> Mitigation: keep CU-01 simple and derive maps inside validators/executors when needed.
- [Risk] Too many validation rules could constrain future modeling prematurely. -> Mitigation: implement only essential invariants plus one explicit non-blocking warning demonstration.
- [Risk] Generation metadata shape may evolve in CU-06/CU-07. -> Mitigation: keep metadata optional, small, declarative, and clearly separated from UML pure data.
- [Risk] Command bus cannot technically prevent consumers from mutating exported plain objects directly. -> Mitigation: document command-route requirement, return cloned documents from command APIs, and avoid exposing mutating helpers as the primary API.

## Migration Plan

CU-01 has no persisted data migration.

Implementation will proceed in three increments:

1. Add `packages/uml-core` workspace and implement canonical document/model/layout types, factories, IDs, and serialization round-trip tests.
2. Implement validation diagnostics, validation result API, initial validation rules, and tests for valid/invalid models plus ERROR/WARNING behavior.
3. Implement typed commands, command bus/executors, snapshot-based local undo/redo, global workspace checks, and CU-01 documentation/status updates.

Rollback before commit is to remove the new change files and incomplete `packages/uml-core` work if implementation fails. No runtime data migration is needed.

## Open Questions

- The exact generation metadata profile may be refined in CU-06/CU-07. CU-01 will keep it optional and declarative so future refinement does not require changing the canonical UML/layout separation.
