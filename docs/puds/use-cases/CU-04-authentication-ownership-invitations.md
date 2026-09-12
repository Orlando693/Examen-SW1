# CU-04 - Authentication, Ownership And Invitations

## Objective

Provide local credential authentication, project ownership authorization, and a secure owner-to-editor invitation lifecycle for persisted UML projects.

## Scope Delivered

- Argon2id passwords, JWT Bearer access tokens with a 60-minute lifetime, and same-tab `sessionStorage` sessions.
- Owner-scoped projects, `EDITOR` memberships, concealed unrelated access, and storage-version CAS.
- One-time, seven-day, email-bound invitation links using a base64url token in a URL fragment and SHA-256 hash at rest.
- Owner invitation create/list/revoke UI and authenticated acceptance/rejection flow.

## Main Components

- Prisma migrations: user, project ownership/membership, invitations, and additive `inviterId` FK.
- `backend/src/auth`, `backend/src/projects`, and `backend/src/invitations`.
- `frontend/lib/auth`, `frontend/lib/invitations`, invitation components, and `/invitations/accept`.

## Security Decisions

- Raw invitation tokens are generated with `randomBytes(32)`, stored only transiently in `sessionStorage`, and persisted only as SHA-256 hashes.
- Invitation tokens are never included in backend paths or queries; acceptance links use `#token`.
- Owner identity and inviter identity are derived from `CurrentUser`; clients cannot supply server fields.
- Invited email is normalized and must match the authenticated user before inspect, accept, or reject.
- Invitation acceptance/rejection uses a transaction and conditional pending-state update. The membership composite key remains the DB integrity boundary.
- Legacy projects with null owners are neither listed nor implicitly claimed. Any backfill is an explicit operator-only database procedure outside public REST APIs.

## Evidence

- Clean PostgreSQL migration chain: all five migrations deployed in order to a temporary empty database; direct `_prisma_migrations` query confirmed five exact finished, non-rolled-back rows; temporary database dropped.
- Automated checks: root tests 133 PASS, backend 24 PASS, frontend 73 PASS, Prisma generate/validate and `db:migrate:test` PASS, typecheck/lint/build PASS, OpenSpec strict PASS, and `git diff --check` PASS.
- Manual Chrome acceptance supplied by the user: owner, editor, unrelated-user, invitation fragment/continuation, revoke/reject, email mismatch, persistence, and console checks PASS.

## Limitations

- Collaboration remains manual Save; realtime synchronization, presence, CRDT/OT, autosave, and Socket.IO are CU-05 scope.
- Playwright is not installed. Manual Chrome evidence is the browser evidence for this CU.

## Closure State

Implementation and final verification tasks are complete. Pending separate closure actions: `/opsx:verify`, user acceptance, archive, commit, and push.
