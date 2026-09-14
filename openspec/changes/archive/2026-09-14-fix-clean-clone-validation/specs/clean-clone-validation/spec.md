## Purpose

Keep clean-clone validation deterministic by respecting workspace type dependencies and database error contracts.

## ADDED Requirements

### Requirement: Root typecheck supports a clean workspace
The root typecheck command SHALL validate all workspaces after producing the type declarations required by their internal workspace dependency, without requiring a separately invoked build command.

#### Scenario: No UML core distribution exists
- **WHEN** `packages/uml-core/dist` is absent after dependencies are installed
- **THEN** `npm run typecheck` completes successfully without TypeScript resolution errors for `@examen-sw1/uml-core`

### Requirement: Membership foreign keys have stable integration assertions
The PostgreSQL integration coverage SHALL verify that deletion of users referenced by project memberships is rejected using Prisma's structured foreign-key error code rather than exception-message wording.

#### Scenario: Deleting referenced editor and owner
- **WHEN** the test attempts to delete an editor and an owner that remain referenced by project memberships
- **THEN** each deletion is rejected with Prisma error code `P2003`
