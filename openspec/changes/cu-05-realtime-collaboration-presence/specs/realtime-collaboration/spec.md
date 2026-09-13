## Purpose

Defines secure server-authoritative realtime UML collaboration with durable ordering, canonical preconditions, immediate persistence, recovery, and convergence for authorized project members.

## ADDED Requirements

### Requirement: One atomic collaboration session per active project
The system SHALL maintain exactly one ephemeral collaboration session per active project in the single backend process, shared by all joined sockets and containing one session identifier, realtime version, queue, dedupe state, lifecycle generation, and eviction state.

#### Scenario: Concurrent first joins share one epoch
- **WHEN** two authorized sockets join a project concurrently while no active session exists
- **THEN** both receive the same newly generated `sessionId`, `realtimeVersion` 0, and coordinator ordering domain

#### Scenario: Join after session eviction starts a new epoch
- **WHEN** the last socket left, reconnect TTL eviction completed, and another authorized socket joins
- **THEN** it receives a new `sessionId`, `realtimeVersion` 0, and an authoritative PostgreSQL snapshot

#### Scenario: Old eviction timer cannot remove a new epoch
- **WHEN** a socket rejoins before or after a prior session eviction timer is superseded
- **THEN** generation verification prevents that old timer from removing the current session

### Requirement: Coordinated project observation and mutation
The system SHALL serialize collaboration session creation, join snapshots, resync snapshots, commands, whole-document save, metadata mutation, and deletion through one logical per-project coordinator.

#### Scenario: Join cannot miss a committed command
- **WHEN** a command and join race for one project
- **THEN** the join either receives a snapshot containing that command or joins the room before the command result is emitted

#### Scenario: External document replacement is ordered with commands
- **WHEN** a whole-document save and realtime command race for one project
- **THEN** the coordinator orders their durable outcomes and no old-epoch command is accepted against an unseen replacement document

### Requirement: Authenticated project collaboration session
The system SHALL let an authenticated socket join at most one active project and SHALL return an authoritative snapshot containing `ProjectResource`, `ProjectDocument.revision`, `storageVersion`, `documentSchemaVersion`, `sessionId`, `realtimeVersion`, document digest, and server-derived access level before enabling mutations.

#### Scenario: Join an authorized project
- **WHEN** an authenticated owner or active editor joins an accessible project
- **THEN** the socket joins `project:<projectId>` and receives the coordinator-captured snapshot and authorized presence roster

#### Scenario: Reject an unauthorized project without disclosure
- **WHEN** an unrelated user, pending invitee, or user requesting an ownerless project attempts to join
- **THEN** the server returns `PROJECT_NOT_FOUND` without joining a room or disclosing project, version, document, digest, or presence information

#### Scenario: Switch active projects
- **WHEN** a socket requests another project
- **THEN** it leaves and cleans the prior project before target authorization, and target failure leaves it subscribed to no project

### Requirement: Socket lifecycle generation
The system SHALL track a monotonic lifecycle generation, active project, active session, and expiration state for each socket and SHALL discard stale asynchronous join, leave, resync, expiry, and disconnect continuations.

#### Scenario: Concurrent switches cannot restore an old room
- **WHEN** a socket has overlapping asynchronous join or switch operations
- **THEN** only the current lifecycle generation can set active project state or receive a successful join result

#### Scenario: Disconnect during authorization
- **WHEN** a socket disconnects while authorization or snapshot retrieval is pending
- **THEN** its stale continuation does not join a room, publish presence, or mutate session state

### Requirement: Explicit realtime command envelope
The system SHALL accept commands only through `{ projectId, sessionId, commandId, baseRealtimeVersion, baseRevision, command }`, deriving actor identity, role, timestamp, storage version, and result versions on the server.

#### Scenario: Accept a valid envelope
- **WHEN** a joined authorized client sends a strict valid envelope for its active project
- **THEN** the server derives authority-owned values and evaluates dedupe, session ordering, canonical revision, execution, and persistence

#### Scenario: Reject forged authority or graph fields
- **WHEN** a request contains client-supplied actor/role/result fields, React Flow nodes or edges, arbitrary document replacement, unknown command type, or malformed fields
- **THEN** it returns `INVALID_COMMAND` before domain execution

### Requirement: Separate command, document, and storage preconditions
The system SHALL use `baseRealtimeVersion` only as current-session ordering, `baseRevision` only as canonical document precondition, and server-read `storageVersion` only as durable authorization-aware CAS.

#### Scenario: Reject a stale session
- **WHEN** a new command names a session identifier that is not the active project epoch
- **THEN** it returns `STALE_SESSION` with `RESYNC` and does not execute or persist

#### Scenario: Reject a stale realtime base
- **WHEN** a new command has the active session but a base realtime version different from the current session value
- **THEN** it returns `STALE_REALTIME_VERSION` with `RESYNC` and does not execute or persist

#### Scenario: Reject a stale document base
- **WHEN** a command passes session ordering but its `baseRevision` differs from the loaded authoritative document revision
- **THEN** it returns `STALE_DOCUMENT_REVISION` with `RESYNC` and does not execute or persist

### Requirement: Canonical idempotent command intention
The system SHALL deduplicate an authenticated command before stale preconditions using `(projectId, sessionId, commandId)` and SHA-256 of deterministic canonical intent encoding containing project, session, actor, bases, and strict decoded command intent.

#### Scenario: Retry after lost acknowledgement
- **WHEN** an identical command from the same session/actor is durably applied but its acknowledgement is lost and the client retries its same request
- **THEN** the server returns `DUPLICATE` with the original authoritative result even though realtime and document versions advanced

#### Scenario: Reuse identifier with different intention
- **WHEN** an existing session command identifier is reused with another actor or canonical intent digest
- **THEN** the server returns `INVALID_COMMAND` without executing, disclosing, or broadcasting the original result

#### Scenario: Retry after epoch replacement
- **WHEN** an old session command is submitted after session invalidation, restart, or eviction
- **THEN** it returns `STALE_SESSION` and never returns a cross-epoch duplicate result

### Requirement: Normalized deterministic command result
The system SHALL strictly decode and normalize every supported UML command before execution, materializing all executor-generated identifiers/defaults and one authoritative timestamp, then return a result that lets clients reproduce the exact canonical document.

#### Scenario: Normalize generated IDs
- **WHEN** a create, move, or layout command omits an ID accepted by the core executor
- **THEN** the server-selected ID is explicit in the normalized command used by server and clients

#### Scenario: Normalize layout updates
- **WHEN** `ApplyLayout` is submitted
- **THEN** unique existing element IDs, finite positions, bounded entry count, no duplicate entries, and required node IDs are validated before execution

#### Scenario: Detect document divergence
- **WHEN** a client applies an authoritative normalized command
- **THEN** it compares the result to the supplied deterministic resulting document digest and resynchronizes on mismatch

### Requirement: Authoritative serialized command execution
The system SHALL reload the authoritative PostgreSQL resource, execute normalized commands through the shared `UmlCommandBus`, validate resulting semantics, and persist through authorization-aware storage CAS before acknowledgement or broadcast.

#### Scenario: Apply and persist a command
- **WHEN** dedupe, access, session, realtime base, document base, execution, validation, and CAS all succeed
- **THEN** canonical revision advances only through the command route, storage version increments once, realtime version increments once, and the command becomes durable before delivery

#### Scenario: Reject domain or semantic failure
- **WHEN** a command is missing-target, invalid, or produces blocking diagnostics
- **THEN** it returns a stable non-applied error without persistence, version advancement, dedupe applied record, or broadcast

#### Scenario: Commit-point failure poisons epoch
- **WHEN** an unexpected failure occurs after durable CAS but before session result finalization or delivery
- **THEN** the old epoch accepts no further commands, is invalidated, and participants recover from a new authoritative snapshot

### Requirement: Bounded CAS conflict recovery
The system SHALL classify an unexpected storage CAS conflict by one bounded reload and SHALL retry at most once only when canonical revision and document digest are unchanged and only metadata/storage version changed.

#### Scenario: Retry metadata-only storage conflict once
- **WHEN** metadata changes storage version while preserving canonical document content and a command loses CAS
- **THEN** the server rechecks access/session/bases and retries once using the new storage version

#### Scenario: Invalidate on canonical conflict or retry exhaustion
- **WHEN** reload shows canonical content changed or the retry conflicts again
- **THEN** the session is invalidated and the command receives a resynchronization outcome without a retry loop

### Requirement: Authoritative acknowledgement and room delivery
The system SHALL return the full applied result only in the originating socket acknowledgement and SHALL broadcast that result only to other currently authorized room participants.

#### Scenario: Originating client applies acknowledgement once
- **WHEN** the originating command is applied
- **THEN** the sender receives `APPLIED` in its acknowledgement and does not receive the matching room broadcast

#### Scenario: Other collaborators receive one broadcast
- **WHEN** an applied command has other authorized participants
- **THEN** each receives one `project:command-applied` event containing normalized command, versions, timestamp, and digest

#### Scenario: Duplicate retry is not rebroadcast
- **WHEN** the server returns `DUPLICATE`
- **THEN** it sends only the original result to the retrying sender and emits no new room event

### Requirement: Stable realtime acknowledgements and errors
The system SHALL use `{ ok: true, status: "APPLIED" | "DUPLICATE", data }` or `{ ok: false, error: { code, message, details? }, action }` with a closed safe error/action matrix.

#### Scenario: Map authentication and stale failures
- **WHEN** authentication expires or session/realtime/document preconditions are stale
- **THEN** the result uses `AUTHENTICATION_REQUIRED` or `AUTH_EXPIRED` with `REAUTHENTICATE`, or `STALE_SESSION`, `STALE_REALTIME_VERSION`, or `STALE_DOCUMENT_REVISION` with `RESYNC`

#### Scenario: Map bounded non-applied failures
- **WHEN** input, domain, payload, or rate validation fails while authority remains certain
- **THEN** the result uses `INVALID_COMMAND`, `DOMAIN_COMMAND_REJECTED`, `SEMANTIC_VALIDATION_FAILED`, `PAYLOAD_TOO_LARGE`, or `RATE_LIMITED` with the specified non-destructive action

#### Scenario: Hide internal details
- **WHEN** persistence, schema, or unexpected failures occur
- **THEN** `CAS_CONFLICT`, `SCHEMA_INCOMPATIBLE`, `INTERNAL_ERROR`, or `INTERNAL_STATE_UNCERTAIN` directs recovery as defined without stack, Prisma, SQL, JWT, token, or concealed project details

### Requirement: Non-optimistic exactly-once client application
The client SHALL keep local intent out of `ProjectDocument`, permit one in-flight UML command per collaboration session, and apply authoritative results through one generation-checked ingestion path.

#### Scenario: Apply the next result
- **WHEN** a current-session result has realtime version exactly one greater than the installed version
- **THEN** the client applies its normalized command once, verifies digest, updates document/revision/storage/realtime values, and resolves matching pending state

#### Scenario: Handle old, gap, session, and timeout results
- **WHEN** an event is old, duplicate, gapped, another session, stale controller generation, or an acknowledgement times out
- **THEN** old events are ignored safely, stale controller events are dropped, and gap/session/timeout transitions to bounded authoritative resynchronization without blind replay

### Requirement: Reconnect without offline mutation queue
The system SHALL block canonical model/layout mutations while joining, disconnected, resynchronizing, expired, revoked, or command-uncertain and SHALL restore editing only after authoritative snapshot installation.

#### Scenario: Lose and restore connectivity
- **WHEN** a connected editor disconnects and later reconnects
- **THEN** no offline command is accumulated, non-mutating viewport actions remain available, and join/resync replaces canonical state before mutation is enabled

### Requirement: Bounded and isolated realtime transport
The system SHALL use configured non-wildcard frontend origins, finite payload/field/collection limits, hard `ApplyLayout` capacity, bounded command/presence rates, bounded buffers, TTL cleanup, and per-emission authorization filtering.

#### Scenario: Reject abuse safely
- **WHEN** transport, command, presence, buffer, or rate limits are exceeded
- **THEN** the server returns the specified bounded failure or disconnects without unbounded state growth or execution

#### Scenario: Isolate protected emissions
- **WHEN** command, snapshot, resource update, or presence is emitted
- **THEN** every recipient has unexpired verified authentication and current OWNER/EDITOR access, and no other room receives protected payload
