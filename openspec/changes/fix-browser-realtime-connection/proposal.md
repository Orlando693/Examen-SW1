## Why

The browser editor can remain in `Connecting` without creating a Socket.IO transport because its client treats the realtime URL inconsistently and relies on implicit connection behavior. The backend, JWT, namespace, and browser WebSocket transport have been independently verified.

## What Changes

- Define `NEXT_PUBLIC_REALTIME_URL` as one unambiguous Socket.IO server base URL.
- Start the browser Socket.IO connection explicitly after listeners are installed.
- Surface handshake failures through a safe collaboration lifecycle instead of leaving the editor in `Connecting`.
- Add regressions for active generations, cleanup, connection errors, and StrictMode-like remounts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `realtime-collaboration`: Browser transport lifecycle and failure behavior for authenticated project collaboration.

## Impact

- Frontend collaboration client, editor lifecycle, environment example, and frontend tests.
- No backend protocol, schema, migrations, dependencies, or durable command semantics change.
