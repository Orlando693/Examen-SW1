## Context

`@examen-sw1/uml-core` intentionally exports its runtime and declaration artifacts from `dist`. The root npm workspace order currently starts frontend and backend checks before UML core, so a clean checkout has no declarations to resolve. Prisma correctly reports foreign-key failures but its human-readable constraint text is not a stable contract.

## Goals / Non-Goals

**Goals:**
- Preserve the package's normal `dist` exports while making the root validation command dependency-aware.
- Assert the Prisma error contract structurally for both protected user deletions.

**Non-Goals:**
- Change standalone consumer workspace scripts, TypeScript strictness, Prisma versions, schema, migrations, or database constraints.

## Decisions

- The root `typecheck` script first builds `@examen-sw1/uml-core`, then runs workspace typechecks. This is the smallest dependency-ordered command change and preserves package exports suitable for runtime and publication. Source-path aliases and source exports were rejected because they would bypass the package boundary or alter its published artifact contract.
- The integration test will capture rejected Prisma operations and assert `PrismaClientKnownRequestError` code `P2003`. Human-readable messages and constraint strings are intentionally excluded because Prisma/provider wording can vary while the code is the stable error classification.
- `UmlEditorClient.test.tsx` uses a suite-local 15-second timeout. Its complete MUI/jsdom editor renders legitimately reach about 6.6 seconds on the clean laptop, while focused runs finish and no timer, polling, cleanup, or functional failure is present. The frontend default remains five seconds, preserving fast hang detection elsewhere.

## Risks / Trade-offs

- Root typecheck performs one additional fast TypeScript emit step. This is required to generate the declarations that the consumer typechecks correctly depend on.
- Prisma metadata can vary by provider/version, so only the stable error class and `P2003` code are required.

## Migration Plan

No migration or deployment action is required. The changed root command is immediately effective after checkout and dependency installation.
