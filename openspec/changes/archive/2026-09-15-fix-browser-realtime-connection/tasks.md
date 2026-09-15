## 1. Browser Transport Lifecycle

- [x] 1.1 Normalize the realtime base-URL contract and explicitly connect only after listeners are registered; verify client tests assert one `/collaboration` URL and one connect call.
- [x] 1.2 Handle `connect_error` through the safe editor lifecycle without exposing transport details; verify a failed handshake leaves no editor in `Connecting`.

## 2. Lifecycle Regressions

- [x] 2.1 Cover restored-session connection, active-generation cleanup, stale callbacks, and StrictMode-like remount behavior; verify no duplicate listeners or transports.
- [x] 2.2 Run focused collaboration/editor tests and frontend typecheck; verify connection, join, reconnect, and resync coverage remains green.

## 3. Validation And Manual Acceptance

- [x] 3.1 Run root typecheck, lint, build, all tests, Prisma generate/validate, and non-destructive DEV/TEST migrations; verify schema and migrations are unchanged.
- [x] 3.2 Validate this OpenSpec change and main specs strictly, then document the exact Chrome acceptance procedure while leaving the change active pending user confirmation.
