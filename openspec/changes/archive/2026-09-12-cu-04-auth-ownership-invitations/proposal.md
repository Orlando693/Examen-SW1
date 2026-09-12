## Why

CU-03 made UML projects durable but intentionally left them globally visible and mutable while no identity existed. CU-04 establishes the identity and access boundary required before CU-05 can safely add multi-user realtime collaboration.

## What Changes

- Keep `GET /health` public without JWT and add local email/password registration and login with Argon2id password hashing and 60-minute JWT Bearer access tokens.
- Add authenticated frontend session handling using `sessionStorage`, protected routes, and bearer-authenticated API requests. Refresh tokens, server-side token revocation, and a logout endpoint are excluded.
- Add `User` persistence with a server-generated UUID identifier and make `Project.ownerId` a nullable foreign key that is assigned only from the authenticated creator.
- Restrict project list/read/save to owners and accepted `EDITOR` members; require each project list item to be unique by project ID; restrict rename/delete and invitation administration to owners. Unrelated users cannot discover a project by identifier.
- Preserve existing JSONB project persistence and `storageVersion` CAS while making authorized document writes conditional on both current access and storage version.
- Add `ProjectMembership` with server-managed creation timestamp and the single initial `EDITOR` role, without duplicating owners as memberships.
- Add seven-day, email-bound, single-use project invitations with hashed random tokens, explicit accept/reject/revoke audit timestamps, and minimal owner/invitee UI that clears transient raw tokens after terminal outcomes.
- Preserve legacy `ownerId = NULL` projects without auto-claiming them; they remain inaccessible until an explicit operator backfill assigns an intended user.

## Capabilities

### New Capabilities
- `authentication`: Local user identity, secure credentials, JWT Bearer authentication, current-user context, and frontend authenticated session behavior.
- `project-access-control`: Ownership and editor membership authorization for persisted project lifecycle operations.
- `project-invitations`: Owner-managed, email-bound invitations that create `EDITOR` membership after a secure acceptance flow.

### Modified Capabilities
- `project-persistence-management`: Project lifecycle requests require authenticated authorized access while preserving canonical persistence envelopes and storage-version compare-and-swap behavior.

## Impact

- Backend: Prisma schema/migration, environment validation, auth and invitation modules, shared API error boundary, and the existing projects repository/service/controller authorization boundary.
- Frontend: App Router login, registration, protected-route, invitation-acceptance, and owner invitation UI; the existing project API client gains bearer authentication without moving editor state into auth state.
- Dependencies: planned Nest JWT support and Argon2id hashing support, with no refresh-token, mail-provider, or realtime dependency.
- Verification: unit, real PostgreSQL API/migration, frontend, and multi-account browser acceptance evidence, including preservation of UML editor save/CAS behavior.
