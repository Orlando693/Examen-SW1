## Why

Authorized project members currently see each other's UML changes only after a manual save and reload. CU-05 must complete Cycle 2 by making PostgreSQL-backed `UmlCommand` execution authoritative and immediately visible to all authenticated collaborators while preserving `ProjectDocument` as the source of truth and React Flow as a projection.

## What Changes

- Add authenticated Socket.IO collaboration sessions with one active project room per socket, OWNER/EDITOR authorization, project switching, JWT-expiry handling, and concealed denial for unrelated or ownerless projects.
- Add server-authoritative UML command processing: one atomic in-process session per project, `sessionId`, `baseRealtimeVersion`, product-required `baseRevision`, UUID command deduplication, shared domain execution and validation, authorization-aware persistence CAS, acknowledgement, and room broadcast.
- Persist every accepted realtime command before returning `APPLIED` or broadcasting it; clients do not apply commands optimistically and recover stale, missing, or replaced sessions from an authoritative PostgreSQL snapshot.
- Add ephemeral, authenticated participant rosters for derived avatars, online/offline state, server-derived last activity, canvas cursors, selections, edited elements, and activity, with bounded updates and complete disconnect cleanup.
- Add a dedicated frontend collaboration boundary and authoritative editor-store path that cannot feed remote changes back into local command handlers or React Flow mutation loops.
- Disable snapshot-based Undo/Redo while a realtime collaboration session is active and replace the connected editor's manual-save workflow with shared persistence states such as saving, saved, disconnected, resynchronizing, and error.
- Preserve `PUT /projects/:id/document` for compatibility and non-realtime use while coordinating accepted external document replacement with active collaboration sessions so it cannot silently overwrite or desynchronize them.
- Add real Socket.IO, Fastify, NestJS, and PostgreSQL integration coverage plus mandatory multi-user Chrome acceptance. Evaluate Playwright as development-only automation without making it a product dependency or replacing manual acceptance.
- Keep `ProjectDocument.revision`, `storageVersion`, ephemeral `realtimeVersion`, `sessionId`, and `documentSchemaVersion` semantically separate, with an authoritative canonical document digest for convergence detection.
- Exclude CRDT, OT, Redis/Kafka, multi-instance realtime coordination, persistent command logs, offline command queues, chat, comments, notifications, revision history, AI, generators, voice, image-to-UML, Flutter, and AWS.

## Capabilities

### New Capabilities

- `realtime-collaboration`: Authenticated project sessions, authoritative command ordering, immediate persistence, acknowledgements, deduplication, reconnect, resynchronization, and transport security.
- `collaboration-presence`: Ephemeral user-level online presence and bounded cursor, selection, editing, and activity state for authorized project participants.

### Modified Capabilities

- `canonical-uml-core`: Define the complete realtime command allow-list, normalized deterministic application requirements, authoritative timestamps/identifiers, and the separation between collaborative application and local snapshot history.
- `manual-uml-workspace`: Route connected editing through the collaboration session, prevent React Flow feedback loops, expose collaboration/persistence/presence UX, and disable local snapshot Undo/Redo while connected.
- `project-persistence-management`: Persist accepted realtime commands before acknowledgement, propagate storage versions, coordinate external whole-document saves with active sessions, and replace connected-session dirty semantics.
- `authentication`: Reuse one JWT-to-current-user authenticator for HTTP and Socket.IO and enforce active-socket token expiration without refresh tokens.
- `project-access-control`: Apply the existing OWNER/EDITOR and concealment policy to room membership, every command, resync, presence, and mid-session access loss.

## Impact

- Backend: new NestJS collaboration module, Socket.IO adapter/gateway, shared token authenticator, atomic project-session registry, shared HTTP/socket project-mutation coordinator, command/session/presence coordination, transport validation and limits.
- Frontend: `socket.io-client`, a collaboration client/controller, authoritative Zustand actions, presence UI, connection/persistence status, and guarded editor controls.
- Core: runtime-safe command transport support and deterministic normalized command application using the existing command bus, executor, document, layout, and validator.
- Persistence: no database migration is planned; durable UML state remains in the existing `Project` row and session epochs, dedupe, queues, presence, and timers remain bounded ephemeral state.
- Tests: real multi-client Socket.IO integration against PostgreSQL, frontend regression coverage, and real Chrome owner/editor acceptance including console checks.
- Deployment: the design targets one backend process; a shared Socket.IO adapter and distributed ordering remain a documented CU-11 concern.
