## Context

The backend and raw browser WebSocket transport are healthy. The frontend currently treats the environment value as a base in `CollaborationClient` while `.env.example` supplies the namespace path, causing a duplicated `/collaboration/collaboration` URL. It also relies on the Socket.IO default auto-connect instead of explicitly starting the transport after listeners exist.

## Goals / Non-Goals

**Goals:**
- Use one base-URL contract and exactly one namespace suffix.
- Make active-generation connection initiation explicit and testable.
- Prevent an indefinite `Connecting` state on handshake failure.

**Non-Goals:**
- Change backend namespaces, JWT, Socket.IO protocol, persistence, command ordering, database schema, migrations, or unrelated UI warnings.

## Decisions

- `NEXT_PUBLIC_REALTIME_URL` is the Socket.IO server base URL, for example `http://localhost:3001`. The client alone appends `/collaboration` exactly once.
- The socket is constructed with `autoConnect: false`; lifecycle listeners are registered before the explicit single `connect()` call. This removes reliance on implicit Socket.IO behavior and makes the active generation observable in tests.
- `connect_error` is a lifecycle event. The editor clears collaboration-only state and transitions to `error` with the existing safe UI error surface; it does not display exception text or credentials.

## Risks / Trade-offs

- A base URL that already includes `/collaboration` is no longer valid. The environment example and tests document the sole supported contract.
- Explicit connection adds a small client interface surface, mitigated by focused client and editor lifecycle tests.

## Migration Plan

Set local `NEXT_PUBLIC_REALTIME_URL` to `http://localhost:3001`, restart the Next.js dev server because public environment variables are compiled into the client bundle, then validate the browser connection manually.

## Manual Acceptance

1. From the repository root in PowerShell, set `$env:NEXT_PUBLIC_REALTIME_URL = 'http://localhost:3001'` and start the backend and frontend with the repository dev commands.
2. Register or log in, open an existing persisted project, then perform a full browser reload.
3. Confirm the editor status changes from `Connecting` to `Connected` and shared mutations are enabled.
4. In Chrome DevTools, confirm one active WebSocket transport to the local Socket.IO server and no failed collaboration request or console error after the reload.
5. Change the URL temporarily to an invalid local port, restart the frontend, reload the same project, and confirm the generic collaboration failure state replaces `Connecting` without exposing transport details. Restore the base URL and restart the frontend after this negative check.

## Recorded Manual Acceptance

Chrome acceptance passed with `NEXT_PUBLIC_REALTIME_URL=http://localhost:3001`: permanent `Connecting`: no; `Invalid namespace`: no; effective namespace: `/collaboration`; `/collaboration/collaboration`: no; live realtime connection: PASS; authorized project: PASS; `auth/me`: PASS; manual blocker: resolved.

The root cause was an old Next/Turbopack bundle compiled with a value that already included `/collaboration`. After stopping frontend and backend, deleting only `frontend/.next`, setting the base URL in the same terminal, and starting `npm run dev`, the browser connected correctly.
