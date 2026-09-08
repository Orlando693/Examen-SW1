# Next.js App Router

The frontend uses Next.js 16 App Router under `frontend/app/`. Preserve that location; do not migrate to `frontend/src/app/`.

## Boundaries

- Use Server Components by default.
- Add `"use client"` only where browser APIs, event handlers, client state, or client-only libraries require it.
- Keep client boundaries small. Do not convert a complete layout into a Client Component merely to support one interactive child.
- Pass only the serializable data a client boundary needs; avoid forwarding unnecessary server state.

## Data And Rendering

- Start independent server work concurrently and await it only where needed to avoid waterfalls.
- Keep server data fetching close to the component that consumes it while preserving parallel work.
- Avoid broad client-side fetches when server rendering can provide the initial data safely.
- Use Next.js 16 conventions and existing project patterns; do not introduce legacy Pages Router patterns.
