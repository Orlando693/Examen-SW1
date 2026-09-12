## 1. INCREMENT 1 — Identity & Authentication Foundation

**Boundary:** Establish user persistence, local credentials, JWT Bearer authentication, and a hydration-safe frontend same-tab session. This increment does not yet restrict the existing project lifecycle by owner/member access and does not add invitations.

- [x] 1.1 Add only the required maintained backend dependencies for Argon2id password hashing and Nest-compatible JWT signing/verification; verify workspace dependency resolution without adding refresh-token, mail, realtime, or OAuth packages.
- [x] 1.2 Add `JWT_SECRET` and the 60-minute access-token TTL configuration to `.env.example` using placeholders only, and add startup configuration validation that fails safely without logging the secret.
- [x] 1.3 Extend Prisma with the minimal `User` model (server-generated UUID `id`, normalized unique `email`, `passwordHash`, `createdAt`, `updatedAt`), reject client-supplied registration IDs, create and inspect a non-destructive migration, and preserve all existing project JSONB/version columns.
- [x] 1.4 Add a focused user repository/service boundary that normalizes email with trim/lowercase and never returns password hashes in safe user representations.
- [x] 1.5 Add registration/login DTO validation for email, bounded passwords, field allow-lists, and safe duplicate-email handling.
- [x] 1.6 Implement Argon2id password hashing and verification, including equivalent verification work and the same public credential failure for unknown emails and wrong passwords.
- [x] 1.7 Implement JWT signing with user UUID subject, 60-minute expiry, verification, bearer extraction, `CurrentUser` context/decorator, and a global bearer guard with explicit public bypasses for `GET /health`, register, and login only.
- [x] 1.8 Add thin `POST /auth/register`, `POST /auth/login`, and guarded `GET /auth/me` controllers with exact safe response contracts and no server logout endpoint.
- [x] 1.9 Generalize the filtered CU-03 API error boundary so validation, duplicate email, invalid credentials, missing/invalid bearer tokens, and unexpected failures retain `{ error: { code, message, details } }` without secret, JWT, Prisma, SQL, or stack leakage.
- [x] 1.10 Add a small frontend auth API/session layer that stores the access token only in `sessionStorage`, restores and validates same-tab sessions after hydration, injects bearer headers, and clears session state on logout or HTTP 401.
- [x] 1.11 Add `/login` and `/register` App Router shells and narrow client form components; implement validated internal-only return paths and protected redirects without converting the root layout or editor store into auth state.
- [x] 1.12 Add backend unit tests for normalization, DTO boundaries, Argon2id hash/verify behavior, generic login failure, JWT verification, current-user guard, safe response shapes, and filtered errors.
- [x] 1.13 Add real PostgreSQL/API and frontend tests for unauthenticated `GET /health` returning its existing 200 contract; register including client-ID rejection; duplicate normalized email; login success/failure; `GET /auth/me`; missing/malformed/expired bearer handling; session restore; logout; 401 clearing; protected redirects; and rejection of `https://attacker.example`, `//attacker.example`, and `javascript:alert(1)` return paths.

**Increment 1 Definition of Done:** A user can register, log in, reload the same tab while the 60-minute bearer token remains valid, retrieve `/auth/me`, and log out locally. Passwords are Argon2id hashes only; protected routes reject invalid bearer tokens with the stable envelope. Relevant backend, PostgreSQL, frontend, and root checks pass. Project access remains CU-03-compatible until Increment 2.

## 2. INCREMENT 2 — Ownership & Project Authorization

**Boundary:** Make persisted project lifecycle operations identity-scoped while retaining CU-03 envelopes, canonical UML persistence, manual Save, local history, and `storageVersion` CAS. This increment creates only the membership foundation necessary for `EDITOR` authorization; it does not expose invitation APIs or UI.

- [x] 2.1 Extend Prisma with nullable `Project.ownerId -> User` and `ProjectMembership(projectId, userId, role, createdAt)` with server-managed `createdAt`, initial `EDITOR` role, owner/user lookup indexes, unique `(projectId, userId)`, restrictive user deletion, and project-child cascade behavior; create and inspect the migration without altering project JSONB/revision/version data.
- [x] 2.2 Document and implement the approved legacy policy at the persistence boundary: null-owner rows receive no implicit owner, are excluded from authenticated access, and may only be backfilled later by explicit operator action outside public REST APIs.
- [x] 2.3 Add a focused project authorization policy and repository queries that distinguish owner-or-editor read/save access from owner-only administration without duplicating owner memberships.
- [x] 2.4 Require `CurrentUser` for `POST /projects` and assign `ownerId` exclusively from that context while continuing to reject client-supplied owner/server fields.
- [x] 2.5 Scope `GET /projects` and `GET /projects/:id` to owned or editor-member projects, return each list project uniquely by ID even with overlapping corrupt/legacy access, and return `PROJECT_NOT_FOUND` for unrelated or ownerless projects without existence/version leakage.
- [x] 2.6 Permit document retrieval/save to owners and `EDITOR` members while preserving structural decode, shared UML validation, `ProjectResource`, manual Save, and editor-history behavior.
- [x] 2.7 Make document writes atomically require project ID, current owner/editor authorization, and `baseStorageVersion`; recheck failures only through authorization-scoped reads to distinguish concealed access loss from authorized stale conflicts.
- [x] 2.8 Restrict metadata PATCH and DELETE to owners; return `FORBIDDEN` to known editor members and concealed `PROJECT_NOT_FOUND` to unrelated users, without changing the existing metadata/delete CAS contracts.
- [x] 2.9 Extend the frontend project API client and project/editor load/save behavior to use the authenticated session helper, preserve conflict/local-work behavior on authorized `409`, and react safely to `401`/concealed access responses.
- [x] 2.10 Update project-management/editor UI to render owner-only rename/delete affordances, retain editor open/save behavior, and redirect unauthenticated access without altering React Flow projection, `ProjectDocument`, `DiagramLayout`, or Zustand editor-domain state.
- [x] 2.11 Add real PostgreSQL/API tests for owned creation, owner spoof rejection, scoped list/read/save, one list item under controlled overlapping owner/member fixture access, owner metadata/delete, editor read/save, editor administrative denial, unrelated concealment, ownerless legacy exclusion, membership `createdAt`/uniqueness, and owner/editor CAS competition or concurrent membership-loss authorization.
- [x] 2.12 Add frontend regressions for authorized project lists, owner/editor affordances, editor save/CAS preservation, protected editor navigation, and no hydration/session regressions; run relevant Increment 2 workspace checks.

**Increment 2 Definition of Done:** All project APIs require authentication. Owners fully administer their projects; editors can list/open/read/edit/save only; unrelated and ownerless projects are concealed. Authorized document saves retain atomic storage-version semantics, and a revoked editor cannot complete an unauthorized write. No invitation API or UI exists yet.

## 3. INCREMENT 3 — Invitations & Membership

**Boundary:** Deliver the secure owner-to-editor invitation lifecycle and minimal owner/invitee UI on the already-authorized project foundation. This increment does not add realtime collaboration or broader role management.

- [x] 3.1 Extend Prisma with `ProjectInvitation`, `PENDING`/`ACCEPTED`/`REJECTED`/`REVOKED` statuses, `EDITOR` invitation role, normalized invited email, unique token hash, `createdAt`, seven-day `expiresAt`, nullable `acceptedAt`/`rejectedAt`/`revokedAt` without `updatedAt`, project/status index, appropriate restrictive user FKs, and project-delete cascade; create and inspect the migration.
- [x] 3.2 Add invitation token primitives using cryptographic random bytes of at least 32 bytes, base64url encoding, SHA-256 hashing, safe comparison, expiry calculation, and token-safe logging rules; never persist raw tokens.
- [x] 3.3 Add invitation DTOs, repository/service boundaries, safe invitation response representations, and stable error mapping for invalid, expired, revoked, already-consumed, and email-mismatched tokens.
- [x] 3.4 Implement owner-only invitation creation at `POST /projects/:projectId/invitations`, returning safe metadata plus the raw acceptance URL exactly once, with no SMTP/email-provider integration.
- [x] 3.5 Implement owner-only invitation listing and pending-only revocation at `GET /projects/:projectId/invitations` and `POST /projects/:projectId/invitations/:invitationId/revoke`; enforce editor denial and unrelated-project concealment.
- [x] 3.6 Implement authenticated `POST /invitations/inspect` that receives token only in the request body, requires exact normalized recipient-email match, and returns minimal acceptance state without a `ProjectResource`.
- [x] 3.7 Implement transactional `POST /invitations/accept` and `POST /invitations/reject` that recheck token hash, pending status, seven-day expiry, project existence, and matching email; acceptance upserts one editor membership, sets only `acceptedAt`, and consumes the token without replay; rejection sets only `rejectedAt`; pending-only revocation sets only `revokedAt`.
- [x] 3.8 Extend the frontend API boundary with typed invitation requests/responses that apply the existing error envelope and never place raw invitation tokens in backend query/path URLs.
- [x] 3.9 Add the owner minimal invitation UI: email input, create action, controlled error/loading state, and one-time display/copy of the generated fragment acceptance link.
- [x] 3.10 Add the `/invitations/accept` route and narrow client flow that reads `#token` after hydration, removes it from the address bar, keeps it only in current-tab transient session state, safely continues through login/register, and clears it from URL/component/session continuation state after accept, reject, terminal expired/revoked/already-used outcomes, or explicit cancellation if supplied.
- [x] 3.11 Add authenticated invitee inspect, accept, and reject UI states; after acceptance redirect to the now-authorized project list or project without open redirects or editor-session contamination.
- [x] 3.12 Add unit tests for token entropy/hash handling, invitation state transitions with exactly one corresponding audit timestamp, email binding, expiry/revocation/replay behavior, safe responses, and no raw-token logging/persistence paths.
- [x] 3.13 Add real PostgreSQL/API tests for owner creation/list/revoke, editor denial, invalid/expired/revoked/replayed tokens, wrong-account rejection, acceptance membership upsert/uniqueness, post-accept editor access, project-delete cascading, and invitation FK/index constraints.
- [x] 3.14 Add frontend tests for owner invitation creation/link display, fragment removal, unauthenticated login/register continuation, minimal inspect, accept/reject outcomes, clearing raw transient token state after accept/reject and terminal responses, post-accept project visibility, and token/session error handling; run relevant Increment 3 workspace checks.

**Increment 3 Definition of Done:** Owners can manually share a one-time seven-day fragment link. Only the intended authenticated email can inspect/accept/reject it; acceptance creates exactly one editor membership, and consumed/revoked/expired tokens cannot grant access. The invitee can open and save the project but cannot administer it.

## 4. FINAL VERIFICATION

- [x] 4.1 Run complete Prisma generation/validation, isolated `TEST_DATABASE_URL` migration, backend unit/API/integration, frontend unit, UML-core, and root test/typecheck/lint/build checks; record exact results and resolve CU-04 regressions.
- [x] 4.2 Review API responses, logs, environment examples, and persisted test data for plaintext passwords, password hashes, JWT secrets, bearer tokens, raw invitation tokens, Prisma/SQL, stack traces, open redirects, and unauthorized resource/version leakage.
- [x] 4.3 Perform multi-account real-browser acceptance with owner, invited editor, and unrelated user: register/login, owner create/open/edit/save/invite, editor fragment acceptance/open/edit/save, editor rename/delete/invite denial, unrelated concealment, logout/session behavior, and no console/hydration/React Flow regressions.
- [x] 4.4 Verify legacy null-owner behavior remains no-list/no-read/no-auto-claim and document the explicit operator-only backfill procedure without creating a public claim endpoint.
- [x] 4.5 Update `docs/puds/use-cases/CU-04-authentication-ownership-invitations.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` with actual implementation, migrations/configuration, evidence, browser outcomes, limitations, security observations, and technical debt; do not claim unexecuted work.
- [x] 4.6 Run `openspec validate "cu-04-auth-ownership-invitations" --strict` and require PASS, run OpenSpec verification, resolve blockers, obtain user acceptance, and only then archive, commit, and push in the separate closure phase.

**Final Definition of Done:** CU-04 has complete automated and multi-account browser evidence, documentation reflects actual behavior, OpenSpec verification has no blockers, and closure actions occur only after user acceptance.
