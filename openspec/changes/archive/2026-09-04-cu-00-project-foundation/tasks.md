## 1. Increment 1 - Monorepo Structure And Initial Configuration

- [x] 1.1 Inspect the current worktree and preserve existing documentation, OpenSpec, and OpenCode configuration.
- [x] 1.2 Create root `package.json` with npm workspaces for `frontend` and `backend`, package metadata, Node.js 24 engine guidance, and root scripts for `dev`, `build`, `lint`, `typecheck`, and `test`.
- [x] 1.3 Create or update root `.gitignore` to exclude dependency folders, build outputs, local environment files, logs, coverage, and temporary artifacts without excluding required documentation or OpenSpec files.
- [x] 1.4 Create root `.env.example` with the CU-00 environment variables needed for backend port, frontend origin, and frontend backend base URL.
- [x] 1.5 Add root documentation in `README.md` for installing dependencies, running frontend/backend development servers, and executing global quality commands from the repository root.

## 2. Increment 2 - Frontend And Backend Foundations

- [x] 2.1 Create `backend/` as a NestJS 11 TypeScript workspace using Fastify as the main HTTP adapter.
- [x] 2.2 Configure backend scripts for development, build, lint, typecheck, and Vitest tests.
- [x] 2.3 Add backend baseline Nest module/application files with no database, auth, Socket.IO, Prisma, or future CU functionality.
- [x] 2.4 Create `frontend/` as a Next.js App Router TypeScript workspace with Material UI.
- [x] 2.5 Configure frontend scripts for development, build, lint, typecheck, and Vitest tests with React Testing Library.
- [x] 2.6 Add frontend baseline App Router files with a minimal Material UI page and no React Flow, Zustand, UML, auth, or future CU functionality.

## 3. Increment 3 - Health Integration, Verification, And Documentation

- [x] 3.1 Add backend `GET /health` returning HTTP 200 with a minimal structured healthy response.
- [x] 3.2 Configure backend local CORS using the documented frontend origin configuration.
- [x] 3.3 Add frontend health request logic using the documented configurable backend base URL.
- [x] 3.4 Render clear frontend states for API available and API unavailable.
- [x] 3.5 Add backend automated test coverage for `GET /health` using Vitest, `@nestjs/testing`, and Supertest.
- [x] 3.6 Add frontend automated test coverage for available and unavailable health states using Vitest and React Testing Library.
- [x] 3.7 Run backend checks: tests, typecheck, lint, and build.
- [x] 3.8 Run frontend checks: tests, typecheck, lint, and build.
- [x] 3.9 Run root global checks for test, typecheck, lint, and build.
- [x] 3.10 Perform a manual local verification that the frontend displays API available when the backend is running and API unavailable when the backend is stopped or unreachable.
- [x] 3.11 Create `docs/puds/use-cases/CU-00-project-foundation.md` documenting objective, scope, decisions, structure, commands, implementation, automated tests, manual tests, errors, corrections, limitations, and final result based on actual implementation.
- [x] 3.12 Update `docs/STATUS.md` and `docs/HANDOFF.md` to reflect the active OpenSpec, CU-00 progress, verification status, and next action.
- [x] 3.13 Review `README.md` so it matches the final implemented commands and local development flow.
- [x] 3.14 Run OpenSpec validation/verification for `cu-00-project-foundation` and address any discrepancies before requesting user acceptance.
