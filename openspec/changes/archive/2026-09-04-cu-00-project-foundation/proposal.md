## Why

CU-00 establishes the first executable foundation of the CASE application. The repository currently has documentation and OpenSpec configuration, but no functional frontend or backend; this change defines the minimal monorepo needed to install, run, test, build, and demonstrate frontend to backend communication.

## What Changes

- Create a root npm workspace monorepo using `frontend/` and `backend/` directly at the repository root.
- Add coherent root scripts for development, build, lint, typecheck, and tests across workspaces.
- Add a Next.js App Router frontend with TypeScript, Material UI, Vitest, and React Testing Library.
- Add a NestJS 11 backend with TypeScript, Fastify as the main HTTP adapter, Vitest, `@nestjs/testing`, and Supertest.
- Add a minimal backend `GET /health` endpoint returning HTTP 200 with a structured healthy response.
- Configure local-development CORS so the frontend can call the backend.
- Make the backend URL used by the frontend configurable through environment variables documented in `.env.example`.
- Render a clear frontend status for `API available` and `API unavailable` based on the health request result.
- Create implementation documentation for `docs/puds/use-cases/CU-00-project-foundation.md` during apply, and update `README.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` when implementation state changes.
- Keep future capabilities out of scope: UML domain, React Flow, Zustand, Prisma, PostgreSQL, auth, Socket.IO, realtime collaboration, code generation, AI, voice, Flutter, and AWS.

## Capabilities

### New Capabilities

- `project-foundation`: Defines the executable monorepo foundation, local development commands, health endpoint, frontend health integration, environment configuration, and baseline quality checks for the main CASE application.

### Modified Capabilities

- None.

## Impact

- Affected project areas: repository root configuration, `frontend/`, `backend/`, `.env.example`, `README.md`, `docs/STATUS.md`, `docs/HANDOFF.md`, and `docs/puds/use-cases/CU-00-project-foundation.md`.
- New runtime dependencies will be limited to the required CU-00 stacks: Next.js, React, Material UI, NestJS 11, Fastify integration, and their required TypeScript/runtime support.
- New test dependencies will be limited to Vitest, React Testing Library, `@nestjs/testing`, and Supertest with the minimum supporting packages needed by those tools.
- No database, authentication, realtime, UML modeling, generation, AI, voice, mobile, or deployment dependencies are introduced in this CU.
