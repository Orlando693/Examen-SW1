## Context

CU-03 provides Prisma-backed project JSONB persistence, a project lifecycle API, and `storageVersion` CAS but deliberately has no user relation or authorization. This change introduces cross-cutting identity, project-access, invitation, migration, and App Router session behavior; see `proposal.md` and its capability deltas for the observable contracts.

## Goals / Non-Goals

**Goals:**
- Keep `CanonicalUmlModel`, `ProjectDocument`, `DiagramLayout`, manual Save, editor history, and storage-version semantics unchanged.
- Establish one backend current-user/authorization boundary reusable by CU-05 without adding realtime behavior.
- Make legacy ownerless data safe by preserving it without exposing an automatic claim path.
- Keep frontend auth session state separate from the Zustand editor domain/session state.

**Non-Goals:**
- Refresh tokens, token rotation/revocation, password recovery, MFA, OAuth, SMTP, user deletion, ownership transfer, or a public legacy-project claim endpoint.
- Socket.IO, realtime authorization transport, presence, broadcasts, CRDT, OT, autosave, generation, AI, voice, image, Flutter, or AWS.

## Decisions

### 1. Stateless JWT Bearer access with same-tab storage

Use a JWT whose subject is the user UUID and whose access lifetime is 60 minutes. A global bearer guard explicitly bypasses only `@Public()` endpoints: the existing `GET /health`, `POST /auth/register`, and `POST /auth/login`; all other CU-04 API endpoints require bearer authentication. Frontend `sessionStorage` holds only the token and a small safe user representation. Logout and any 401 clear this state locally. `JWT_SECRET` is required configuration and is never logged or committed.

This directly fulfills the decided JWT Bearer contract without requiring cookie/CSRF design or persistent refresh-token records. HttpOnly cookie sessions and refresh token rotation were rejected because they add requirements not present in CU-04; in-memory-only tokens were rejected because a normal same-tab reload would unnecessarily discard an approved session.

### 2. Local credential boundary

Introduce an auth module with thin HTTP adapters, a user persistence boundary, Argon2id hashing/verification, token signing, a bearer guard, and a current-user decorator/context. `User` contains only a server-generated UUID `id`, normalized unique `email`, `passwordHash`, `createdAt`, and `updatedAt`; registration cannot supply an ID. Email normalization occurs before uniqueness lookup and persistence. Login uses one generic credential error for unknown email and wrong password, including comparable password-verification work for unknown accounts.

Password hashes are never selected into API response DTOs or logged. Argon2id is chosen over plaintext, reversible encryption, and bcrypt because it is a password-hardening algorithm with memory cost suitable for new credentials; implementation will use a maintained Node-compatible Argon2id dependency.

### 3. Ownership and membership persistence

Add `User`, `ProjectMembership`, and `ProjectInvitation`. `Project.ownerId` remains nullable while gaining a `User` FK, so existing rows migrate without guessed ownership. New projects receive `CurrentUser.id` only at the service boundary. A membership contains `projectId`, `userId`, initial `EDITOR` role, and server-managed `createdAt`, with unique `(projectId, userId)`; owner authority remains solely in `Project.ownerId`.

Project deletion cascades to memberships and invitations. User deletion remains restricted because its lifecycle is out of scope. Legacy ownerless rows are neither listed nor readable through authenticated APIs. An operator-only documented backfill can explicitly assign selected null-owner rows after the intended user exists; it is not a public endpoint or automatic migration.

### 4. Central authorization and CAS-aware repository operations

The projects service receives `CurrentUser`, while repository reads and mutations are scoped to owner/member eligibility. Authorization policy distinguishes read/save eligibility (owner or editor) from administration (owner only). Project list queries are unique by project ID even if corrupt/legacy data gives the same user overlapping owner and membership access. An unrelated caller receives `PROJECT_NOT_FOUND`; an editor who knows the project but lacks an administrative permission receives `FORBIDDEN`.

For document save, decode and validate the candidate from an authorization-scoped authoritative row, then run one conditional write requiring project ID, eligible authorization, and `storageVersion`. A zero-row update is followed only by an authorization-scoped read: absent access becomes `PROJECT_NOT_FOUND`; retained access with a changed version becomes `PROJECT_REVISION_CONFLICT`. This prevents a concurrently revoked editor from completing a save and does not reveal the authoritative version to unauthorized callers.

Read-then-write authorization alone was rejected because membership revocation could race the write. Replacing `storageVersion` with canonical revision remains rejected for the CU-03 reasons: Undo/Redo makes canonical revision unsuitable as a durable monotonic lock.

### 5. Invitation token and transaction lifecycle

Creation generates at least 32 random bytes using the platform cryptographic RNG, encodes them base64url, stores only SHA-256 hash, and returns the raw token once in an owner-only response. Invitation persistence stores normalized recipient email, `EDITOR`, `PENDING`, `createdAt`, `expiresAt = now + 7 days`, and nullable `acceptedAt`, `rejectedAt`, and `revokedAt` audit fields. Each terminal transition sets only its corresponding audit field to the transition time and leaves the other terminal audit fields null.

Inspect, accept, and reject receive token in request body, never a backend path/query. They authenticate first and require exact normalized recipient-email match. Acceptance uses a database transaction that rechecks token hash, `PENDING`, expiry, project existence, and recipient before upserting membership and marking `ACCEPTED`; therefore a token cannot be replayed. Revocation changes only a pending invitation to `REVOKED`.

Persisting raw tokens, accepting any bearer-token holder, or sending tokens as API URL parameters were rejected because they increase leakage and forwarding risk. SMTP is intentionally excluded; the owner manually shares the returned fragment-based link.

### 6. Hydration-safe App Router auth and invitation flow

Keep route shells under `frontend/app/` as Server Components and localize browser session access, forms, redirects, and fragment processing in small Client Components. An auth session layer synchronizes with `sessionStorage` only after hydration, avoids placing `ProjectDocument` in auth state, and validates internal return paths before navigation.

The invitation route reads `/invitations/accept#token=...` after hydration, immediately removes the fragment with browser history replacement, and retains the token only in same-tab transient session state while login/register completes. Successful accept/reject and terminal expired/revoked/already-used responses clear that transient token from component/session state; explicit cancellation clears it too if supplied. Authenticated project/invitation requests flow through the existing focused API client extended with bearer-header/error handling. Existing editor loading/session behavior remains separate and receives only authorized project API responses.

Using query/path tokens was rejected because URLs reach request logs. Making the entire root layout a client component was rejected because only interactive session components require browser state and CU-02 hydration constraints must remain intact.

### 7. Shared API error envelope

Generalize the existing filtered project error boundary into a coherent API error boundary while retaining `{ error: { code, message, details } }`. It maps validation, authentication, authorization, invitation state, persistence, and unexpected failures without exposing Prisma, SQL, password hash, token, JWT, secret, or stack details.

## Risks / Trade-offs

- [A bearer token in browser storage is available to XSS] -> Use `sessionStorage`, short expiry, no token URLs, strict client boundaries, and avoid persistent local storage; cookie/CSRF architecture remains a future explicit decision.
- [Legacy ownerless projects become unavailable] -> Preserve rows and provide documented operator-only explicit backfill rather than insecure auto-claim.
- [Authorization and CAS queries become more complex] -> Cover owner/editor/unrelated/revoked-member paths using real PostgreSQL concurrency evidence.
- [Invitation links can be manually forwarded] -> Bind acceptance to the intended normalized email and hash tokens at rest.
- [Auth state can cause hydration or redirect loops] -> Use hydration-safe client initialization, narrow effects only for browser storage/external navigation, and test return-path/session transitions.
- [New password/JWT dependencies affect backend packaging] -> Keep dependencies focused, document configuration, and run root dependency/build verification.

## Migration Plan

1. Add User, membership, invitation enums/tables, nullable project owner FK, indexes, and FK actions in a new Prisma migration without changing project JSONB/version columns.
2. Apply the migration first to the isolated `TEST_DATABASE_URL` database and prove schema constraints, cascade/restrict behavior, and owned-project API flows with new users.
3. Configure non-secret JWT variables locally from `.env.example`; fail startup clearly when the required secret is absent for the authenticated backend.
4. Deploy backend auth/access enforcement and frontend session changes together so existing unauthenticated project clients cannot retain global project access.
5. Keep legacy null-owner rows untouched; operators backfill only selected rows to an explicit intended user outside public application APIs.
6. Roll back application code only with an environment-specific migration decision. Do not automatically delete users, projects, JSONB documents, memberships, or invitations during startup or rollback.
