## Why

A clean checkout can typecheck only after a manual build because the root workspace order checks consumers before the generated type declarations of `@examen-sw1/uml-core` exist. A PostgreSQL integration test also assumes a Prisma error-message wording even though the foreign-key protection itself is correct.

## What Changes

- Make the root typecheck command build the UML core declarations before checking its workspace consumers.
- Replace message-based Prisma foreign-key assertions with stable Prisma error-code assertions for both referenced-user deletion paths.
- Set a file-scoped timeout for the verified heavy UML editor jsdom suite without weakening the frontend-wide timeout.
- Record and verify the clean-clone validation procedure without changing database constraints or migrations.

## Capabilities

### New Capabilities
- `clean-clone-validation`: Reproducible root validation for workspace type dependencies and stable database-constraint test assertions.

### Modified Capabilities

- None.

## Impact

- Root `package.json` scripts.
- PostgreSQL projects API integration test.
- No runtime API, database schema, migration, or dependency changes.
