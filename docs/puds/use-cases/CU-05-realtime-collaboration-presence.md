# CU-05 - Realtime Collaboration And Presence

## Objective

Allow authorized project owners and editors to collaborate through Socket.IO while PostgreSQL remains the durable authority and `ProjectDocument` remains the canonical UML source of truth.

## Scope and Dependencies

CU-05 builds on persisted projects, JWT authentication, ownership, and editor memberships from CU-03 and CU-04. It does not add CRDT/OT, distributed coordination, external mutation coordination, or a persistent command log.

## Increment 1

Increment 1 implemented authenticated rooms, session lifecycle, PostgreSQL-backed authoritative join/resync snapshots, ephemeral roster/presence, flow-space cursors, bounded client/server presence updates, and frontend lifecycle buffering. Owner/editor manual acceptance was supplied by the user.

## Increment 2 Implementation

- The backend strictly decodes and normalizes all 19 supported `UmlCommand` variants, then executes them only with `UmlCommandBus`.
- The command coordinator serializes per-project work, deduplicates canonical intents, validates session/realtime/document bases, persists via authorization-aware CAS, and treats the returned CAS row as the durable commit point.
- Applied results include normalized commands, distinct revisions, storage/realtime versions, server timestamp, and canonical SHA-256 document digest. Sender ACK and authorized collaborator broadcast use the same result.
- The frontend command gate is non-optimistic. The authoritative ingestion controller installs snapshots and applies only contiguous verified results, with bounded recovery on timeout, gaps, stale generations, or digest mismatch.
- Authoritative installations rebase local history. Realtime drag commits one `MoveNode`; auto-layout sends one `ApplyLayout` and never reruns ELK remotely.

## Decisions

- `ProjectDocument.model` is semantic authority, `ProjectDocument.layout` is visual persisted state, and React Flow remains a projection.
- `revision`, `storageVersion`, `realtimeVersion`, `sessionId`, and `documentSchemaVersion` are separate domains.
- Accepted commands are persisted before acknowledgement or broadcast. No optimistic canonical mutation, blind retry, or client-selected storage version is allowed.
- The implementation targets one backend process. Session state, dedupe, presence, and queues are ephemeral.

## Automated Evidence

- `backend/test/realtime-collaboration.integration.spec.ts` uses real Nest/Fastify, Socket.IO clients, and isolated PostgreSQL. It now covers all 19 command types, owner/editor propagation, canonical model/layout/digest convergence, validation and target failures, same-base conflicts, dedupe, version domains, durable commit-before-APPLIED, and epoch replacement/reopen recovery.
- `backend/src/collaboration/collaboration-session.manager.spec.ts` uses a fake clock to verify reconnect eviction cancellation and old-timer safety.
- Focused backend verification passed: 28 tests, typecheck, and lint.

## Manual Evidence

User-provided durable realtime acceptance passed for OWNER and EDITOR: create, rename, move, and add attribute propagated without Save or reload. A lowercase-class validation diagnostic was observed as expected. No additional manual retest was requested for this increment closure.

## Known Limitations And Next Scope

- Increment 3 remains pending: HTTP PUT/PATCH/DELETE coordination, `project:resource-updated`, final transport hardening, editor lifecycle/status UX, responsive presence UI, and browser acceptance preparation.
- Tasks 1.6 and 1.13 remain unchecked only because each explicitly includes protected resource-update behavior from Increment 3. Task 1.8 is complete.
- The active design is single-process only; distributed realtime coordination remains future work.

## Result

Increment 2 is implementation-complete and documented. The CU and its OpenSpec remain active: no archive, push, or final CU acceptance has occurred.
