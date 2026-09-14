## Context

See `proposal.md` for motivation. `ProjectDocument.model` is the canonical UML semantic source, `ProjectDocument.layout` is persistible logical placement, and React Flow remains a projection. Existing `UmlCommandBus` execution touches canonical revision; `storageVersion` is the existing authorization-aware PostgreSQL CAS token. Current `UmlHistory` restores snapshots and is therefore unsafe as collaborative history.

CU-05 targets one NestJS/Fastify process. PostgreSQL remains durable authority. No session, dedupe, presence, cursor, roster, or realtime sequence is persisted. The existing HTTP document, metadata, and delete contracts remain supported but must be coordinated with realtime operations.

## Goals / Non-Goals

**Goals:**

- Serialize all authoritative project observations and mutations through one in-process project coordinator.
- Persist each accepted UML command before acknowledgement or broadcast and make all clients converge from normalized commands plus canonical digests.
- Preserve distinct document, storage, realtime, session, and format version domains.
- Provide secure full participant presence without adding a database schema.
- Prevent stale sockets, React Flow feedback, snapshot Undo, and client-side optimistic divergence.

**Non-Goals:**

- CRDT, OT, automatic rebase, offline command queues, distributed Undo/Redo, Redis, Kafka, persistent command logs, or multi-instance coordination.
- Chat, comments, notifications, revision history, AI, generators, voice, image-to-UML, Flutter, or AWS.

## Decisions

### 1. Atomic project session registry and coordinator

The process owns exactly one `ProjectSession` record per active `projectId`:

```text
projectId -> {
  generation, sessionId, realtimeVersion, queue, dedupe,
  lifecycleState, joinedSockets, evictionTimer
}
```

`getOrCreate(projectId)` is synchronous/atomic within the registry and is the only creation path. Concurrent first joins receive the same record, UUID `sessionId`, version `0`, and queue. Presence may use a focused registry but is keyed to this same session generation.

`ProjectMutationCoordinator` is the sole serialization boundary for session creation, join snapshots, resync, command execution, `PUT /projects/:id/document`, metadata PATCH, and DELETE. It has no second lock. Queue work captures the session generation and verifies it before committing session-side results.

When the final socket leaves, a configurable short reconnect TTL schedules eviction with `{ projectId, generation }`. The callback removes state only when generation remains current, no sockets or queued/in-flight operations remain, and the queue is idle. A join cancels pending eviction. A prior timer cannot remove a later epoch.

### 2. Per-socket lifecycle generation

Socket state contains `lifecycleGeneration`, `activeProjectId`, `activeSessionId`, `switching`, and verified expiry. Join, switch, leave, disconnect, and expiry increment or capture this generation. Every asynchronous continuation verifies that the socket is connected and its lifecycle generation, authenticated identity, target project, and expected session remain current before changing a room, presence, or acknowledgement state.

Switching A to B first invalidates the socket lifecycle, disables mutations, leaves/cleans A, sets no active project, authorizes B, then joins B through the coordinator. A failed B authorization leaves the socket in no project. A command project ID must equal `activeProjectId`; otherwise it returns `PROJECT_NOT_JOINED`.

### 3. Join and resync atomicity

Within the project queue, join authorizes access, obtains the one session, reads the structurally/semantically valid PostgreSQL resource, captures `{ sessionId, realtimeVersion, resource, accessLevel, documentDigest }`, adds the socket to the room, records presence, and only then releases the queue. Thus an accepted later command either broadcasts after room membership or is reflected in the join snapshot.

The frontend registers listeners before join and keeps a bounded 128-event join buffer. It buffers only applied events for the current controller generation and expected project. After join/resync snapshot installation it discards events at or below the snapshot realtime version, applies only contiguous newer events, and resyncs on a gap or buffer overflow. Switching/disposal clears the buffer.

### 4. Version and command preconditions

The request is:

```text
{ projectId, sessionId, commandId, baseRealtimeVersion, baseRevision, command }
```

`baseRealtimeVersion` is the current session ordering precondition. `baseRevision` is the canonical document precondition. `storageVersion` is never client authority and remains the sole durable CAS token read by the server. `documentSchemaVersion` remains persistence-format compatibility.

For a new command, the server checks current session, exact realtime base, reloads the durable resource, then checks exact canonical revision before execution. `UmlCommandBus` alone increments canonical revision. Only accepted realtime commands increment `realtimeVersion`; joins, resyncs, presence, duplicates, rejections, and metadata updates do not.

### 5. Canonical intent, dedupe, normalization, and digest

The command path is:

```text
strict decode -> materialize semantic defaults -> canonical intent encoding
  -> SHA-256 intent digest -> normalizeRealtimeCommand -> UmlCommandBus
```

Canonical intent encoding uses deterministic canonical JSON semantics: sorted object keys, preserved array order, finite JSON numbers, no `undefined`, strict decoded fields only, and semantic defaults materialized before hashing. The SHA-256 input includes `projectId`, `sessionId`, `actorUserId`, `baseRealtimeVersion`, `baseRevision`, and decoded command intent; it excludes `commandId`, generated IDs, timestamp, resulting versions, result document, and acknowledgement fields.

Dedupe lookup occurs after authenticating/current socket-project context and before stale checks. Its key is `(projectId, sessionId, commandId)` and stored data is actor ID, intent digest, and original applied result. An identical retry returns `DUPLICATE` even after realtime version advanced; changed actor or intent returns `INVALID_COMMAND`. A command from another epoch returns `STALE_SESSION`; old epoch dedupe is cleared on invalidation/eviction.

`normalizeRealtimeCommand` is pure against the reloaded document. It materializes every optional ID/default consumed by the existing executor, including class, enum, literal, attribute, association/generalization, `MoveNode`, and `ApplyLayout` node IDs. It validates unique existing layout element IDs, finite coordinates, bounded entries, and no duplicate layout entries. The server selects one millisecond ISO `appliedAt`. Clients execute only the normalized command with that timestamp and never rerun ELK.

`ProjectCommandApplied` includes project/session/command identity, actor, base and resulting realtime versions, base and resulting document revisions, storage version, `appliedAt`, normalized command, and `resultingDocumentDigest`. The digest is SHA-256 of deterministic canonical `ProjectDocument` serialization from the exact durable result. Join/resync snapshots contain the full resource and the same digest. Digest mismatch triggers resync; it never bypasses semantic validation.

### 6. Durable command commit point and delivery

For a new command in the project queue:

1. Recheck socket lifecycle, token expiry, current user, project access, and active session.
2. Dedupe lookup, then session/realtime checks.
3. Reload/validate durable resource and check `baseRevision`.
4. Decode/normalize, execute through `UmlCommandBus`, and validate candidate semantics.
5. Persist with authorization-aware CAS using server-read `storageVersion`.
6. **Durable commit point:** CAS succeeds and returns the exact updated resource.
7. Advance session realtime version, create/store dedupe result, then deliver it.

The originating socket receives the full applied result only through the acknowledgement. `socket.to(projectRoom)` broadcasts that applied result only to other authorized participants. A duplicate retry receives only its original acknowledgement result and no second broadcast. Clients still defend by command/version dedupe.

If an unexpected failure occurs after the durable commit point but before session result finalization/delivery, the epoch is poisoned: new commands are blocked, prior session identifiers become stale, state is rebuilt from PostgreSQL under a new epoch, and connected clients receive `project:resync-required` where safe. PostgreSQL wins; no false rollback or old-epoch retry is attempted.

### 7. Durable CAS classification and external mutations

An unexpected command CAS conflict reloads once. If the project/access is gone, conceal and remove the socket. If canonical revision and canonical document digest are unchanged and only metadata/storage version changed, retry exactly once using fresh storage version while keeping the same session/base preconditions. If canonical content changed, or a second conflict occurs, invalidate/resync the epoch. There is no retry loop.

HTTP PUT, PATCH, and DELETE execute inside the same coordinator. PUT uses CAS then invalidates the collaboration epoch; it is never represented as a fake UML command or a realtime-version increment. Active clients receive resync-required/rejoin and old epoch commands become `STALE_SESSION`. PATCH increments storage version only and sends an authorized `project:resource-updated` metadata/version event without changing canonical revision or realtime version. DELETE invalidates the epoch, removes room sockets and presence, cleans timers/dedupe, and subsequent commands return `PROJECT_NOT_FOUND`.

### 8. Protected emission and expiration

The shared authenticator verifies signature, subject, expiry, and current user for HTTP and `handshake.auth.token`. Token expiry timers remain, but expiry and access are rechecked after queue wait and immediately before every command mutation.

Before every protected command, snapshot, resource-update, presence, or applied-result emission, recipients are filtered by unexpired verified token and current OWNER/EDITOR access. Invalid recipients are removed from rooms/presence/session state and receive only a generic safe revocation signal where possible. There is no documented exposure window. This is intentionally per-emission revalidation for the single-process MVP.

### 9. Frontend lifecycle, ingestion, and history

The collaboration controller owns a monotonic controller generation keyed to project/socket lifecycle. Stale HTTP responses, joins, resyncs, timers, socket events, and ELK completions are ignored. The controller is outside `UmlCanvas`; auth remains in the existing session layer.

Editor collaboration state is separate from `ProjectDocument`: connection lifecycle, session/revision/storage versions, one pending command, controller generation, bounded join buffer, and presence. `submitRealtimeCommand()` is the only durable mutation entry point while connected. Exactly one UML command may be in flight; pan, zoom, selection inspection, and presence remain available.

Applied ingestion rules are explicit: next current-session version applies once and verifies digest; consumed/older versions are ignored; future versions trigger one resync; other-session events resync; stale controller events are dropped. Ack timeout applies no intent, clears no canonical state, enters resyncing, and does not create a new command ID automatically. Snapshot installation atomically replaces document/version tracking, clears uncertain pending state, discards old buffered events, then applies contiguous newer buffered events.

Every authoritative join, own result, remote result, and resync snapshot recreates/rebases `UmlHistory` with the current authoritative document and empty stacks. Authoritative events are never history entries. Leaving collaboration creates fresh empty history from the latest authoritative document, preventing pre-collaboration snapshots from resurfacing.

The web editor always attempts realtime mode for editable persisted projects: connecting, joining, connected, resyncing, disconnected, auth-required/error. It never falls back to HTTP snapshot Save after socket failure and has no offline mutation queue. Connected Save becomes a non-action status (`Saving`, `Saved`, `Disconnected`, `Resynchronizing`, `Error`); a visible Save control is disabled/non-actionable. Non-mutating viewport operations remain available while disconnected.

### 10. Presence and React Flow presentation

Presence has an ephemeral authorized participant roster sourced from project owner plus accepted EDITOR memberships. Each entry has safe identity, server-derived access level, derived initials/avatar from normalized email, `online`, and nullable server-derived `lastActivityAt`. Pending, rejected, revoked, and unrelated users are excluded. Offline authorized participants remain visible with `online: false`; roster and activity are never persisted.

Per socket state is a full snapshot: `{ cursor, selectionIds, editingElementId, activity }`. The client cannot send identity, role, or activity timestamp. The server tracks `lastActivityAt`; the user-level aggregate selects the most recently active connected socket. On active-socket disconnect it recomputes from remaining sockets; with none it clears cursor/selection/editing and marks offline. No duplicate user rows appear.

Cursor input is converted by the originating React Flow instance with `screenToFlowPosition` and transmits finite flow-space coordinates only. Receivers render via viewport-aware React Flow projection/portal; remote cursors and selections never alter the receiver's viewport or local selection. Cursor updates coalesce to 20 Hz; selection/editing/activity send immediately and cancel obsolete trailing cursor work. The server allows a bounded burst and at most 30 presence updates/second/socket; disconnect/leave cleanup is immediate.

Remote command/presence application writes canonical state only through authoritative store actions. Outbound commands originate only in explicit local handlers. `MoveNode` is emitted only on drag commit, never pointer frames; cursor is a separate channel. Initial authoritative join may fit once. Command results, resync, presence, and remote/local layout changes never auto-fit; explicit Fit View remains available.

### 11. Limits, errors, and test evidence

Socket CORS uses the configured frontend-origin allow-list, never wildcard authenticated origin. Configure transport payload maximum, command/presence rates, string and collection maxima, hard `ApplyLayout` entry maximum, bounded join buffer, session/dedupe capacities, and TTL cleanup. No token appears in logs/errors.

Stable errors use explicit code/action mappings: `AUTHENTICATION_REQUIRED`/`AUTH_EXPIRED` -> `REAUTHENTICATE`; `PROJECT_NOT_FOUND` -> leave; `PROJECT_NOT_JOINED`, `STALE_SESSION`, `STALE_REALTIME_VERSION`, `STALE_DOCUMENT_REVISION`, `CAS_CONFLICT`, `SCHEMA_INCOMPATIBLE`, and `INTERNAL_STATE_UNCERTAIN` -> `RESYNC`; `INVALID_COMMAND`, `DOMAIN_COMMAND_REJECTED`, `PAYLOAD_TOO_LARGE`, and `RATE_LIMITED` -> `NONE`; semantic validation returns `NONE` when server state is certain and `RESYNC` only when uncertainty exists; unexpected `INTERNAL_ERROR` requests resync when state may be uncertain. Errors never expose stack, Prisma, SQL, JWT, or token details.

Increment 1 establishes a real listening Nest/Fastify/Socket.IO/PostgreSQL harness. `TEST_DATABASE_URL` is fail-hard, must be isolated from `DATABASE_URL`, never falls back to it, and test fixtures are created/cleaned by each suite. Deterministic service barriers/test clocks support first-join, eviction, same-base, HTTP race, access-loss, expiry, and post-CAS fault tests without sleep-only assertions. Manual multi-profile Chrome remains mandatory; Playwright is optional development-only support.

## Risks / Trade-offs

- [Per-emission access checks and PostgreSQL reloads add latency] -> Serialize only project operations, emit cursor presence separately, and measure before adding cache complexity.
- [Strict bases reject concurrent unrelated changes] -> Explicit resync and user retry; no hidden OT/CRDT behavior.
- [Epoch invalidation after PUT is disruptive] -> It prevents an old intention from applying to a replacement document.
- [Derived avatars/last activity are ephemeral] -> Meets presence without schema expansion; restart clears unknown activity safely.
- [One in-flight command lowers local throughput] -> It is the safe MVP choice for strict ordering/non-optimistic UI.
- [Single-process registry cannot scale horizontally] -> CU-11 must introduce shared adapter, coordination, and distributed ordering before multi-instance deployment.

## Migration Plan

1. Add dependencies/configuration and shared auth without database migration or HTTP contract removal.
2. Add coordinator/session/lifecycle/test harness before realtime command handling.
3. Add presence and join lifecycle, then authoritative command execution and recovery.
4. Coordinate external HTTP mutations and collaborative UI behavior.
5. Verify real PostgreSQL/Socket.IO and manual Chrome evidence.
6. Rollback removes the collaboration namespace/client; existing database rows and HTTP APIs remain valid.
