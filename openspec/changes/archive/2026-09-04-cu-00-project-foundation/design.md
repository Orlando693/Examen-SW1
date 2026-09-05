## Context

See `proposal.md` for motivation. The repository is document-only today and CU-00 must create the first executable application foundation without advancing later UML, persistence, collaboration, generation, AI, voice, mobile, or deployment work.

The product stack requires a separate main frontend and backend: Next.js App Router with TypeScript and Material UI for the frontend, and NestJS 11 on Fastify with TypeScript for the backend. The user explicitly requires the workspace folders to be `frontend/` and `backend/` at repository root, not `apps/web` or `apps/api`.

## Goals / Non-Goals

**Goals:**

- Establish a minimal npm workspace monorepo from the repository root.
- Make the root the normal entry point for install, development, build, lint, typecheck, and tests.
- Keep frontend and backend independently runnable for local development.
- Demonstrate browser-visible frontend to backend communication through `GET /health`.
- Configure only environment variables needed by CU-00 and document them in `.env.example`.
- Leave all CU-00 quality gates green: backend tests, backend typecheck, backend lint, backend build, frontend tests, frontend typecheck, frontend lint, and frontend build.
- Produce implementation documentation during apply that reflects only what is actually built.

**Non-Goals:**

- No UML model, `ProjectDocument`, `DiagramLayout`, validation engine, `UmlCommand`, Command Bus, Undo/Redo, React Flow, ELK.js, or Zustand.
- No Prisma, PostgreSQL, authentication, ownership, invitations, Socket.IO, realtime collaboration, or presence.
- No generated Spring Boot backend, Domain Manifest, generated frontend, Flutter, Qwen, Vosk, Florence-2, benchmarks, or AWS deployment.
- No monorepo orchestration tool such as Turborepo or Nx unless separately approved later.
- No complex health contract, service discovery, Docker setup, database readiness check, or OpenAPI setup in CU-00.

## Decisions

### Use npm workspaces only

The root `package.json` will declare workspaces for `frontend` and `backend` and provide scripts that delegate to workspace scripts.

Rationale: npm workspaces are sufficient for two packages and avoid introducing Turborepo, Nx, pnpm, Yarn, or another orchestration layer before there is a concrete need.

Alternatives considered:

- Turborepo or Nx: rejected for CU-00 because they add configuration and concepts without solving an immediate problem.
- Independent package installs in each folder only: rejected because the CU requires coherent root-level scripts and a monorepo workflow.

### Keep `frontend/` and `backend/` as first-class packages

Each workspace will have its own `package.json`, TypeScript configuration, lint configuration where needed, test setup, and build command.

Rationale: the frontend and backend have different frameworks, runtime assumptions, test environments, and build outputs. Keeping local package boundaries explicit makes later CUs easier without adding a larger monorepo tool.

Alternatives considered:

- Single root package containing all framework configuration: rejected because it blurs the separation between Next.js and NestJS and would complicate framework commands.
- `apps/web` and `apps/api`: rejected because the CU explicitly prohibits those paths.

### Build the backend on NestJS 11 with Fastify from the start

The backend bootstrap will use the Nest Fastify adapter as the main HTTP adapter and must not rely on Express as the primary adapter.

Rationale: product and CU requirements require NestJS 11 on Fastify; starting with Fastify avoids a later adapter migration.

Alternatives considered:

- Nest default Express adapter: rejected because it violates CU-00 and product constraints.

### Use a minimal health resource

The backend will expose `GET /health` returning HTTP 200 and a small structured JSON body, for example a status-like field indicating the API is healthy.

Rationale: CU-00 only needs executable connectivity. Database, auth, readiness, liveness, OpenAPI, and dependency checks belong to later CUs or operational hardening.

Alternatives considered:

- Detailed health contract with version, uptime, dependency checks, and database state: rejected because it over-specifies a contract before those dependencies exist.

### Use environment driven frontend backend URL

The frontend will build the health request from a documented public environment variable such as `NEXT_PUBLIC_API_BASE_URL`. The backend will use a development CORS origin variable such as `FRONTEND_ORIGIN`, with a documented local default.

Rationale: Next.js only exposes browser-side environment variables with the `NEXT_PUBLIC_` prefix, and CORS must explicitly allow the development frontend origin.

Alternatives considered:

- Hardcoding `http://localhost:<port>` in UI code: rejected because the CU requires configurability.
- Server-only environment variable for browser fetches: rejected because client-side requests would not receive it.

### Test the health integration without E2E infrastructure

Backend tests will verify the HTTP health endpoint using Nest testing utilities and Supertest. Frontend tests will verify rendered available and unavailable states by controlling or mocking the health request path.

Rationale: CU-00 requires Vitest and React Testing Library, not Playwright. Browser E2E infrastructure is documented for later use but not needed to prove this CU.

Alternatives considered:

- Playwright E2E test for the health page: rejected for CU-00 because it adds an extra tool and is not requested in this CU's quality gates.

### Keep documentation factual during apply

`docs/puds/use-cases/CU-00-project-foundation.md`, `docs/STATUS.md`, `docs/HANDOFF.md`, and `README.md` will be updated during implementation based on what is actually created and verified.

Rationale: repository rules prohibit documenting functionality as implemented before it exists.

Alternatives considered:

- Creating the CU implementation document during proposal as if implementation were complete: rejected because this phase is planning only.

## Risks / Trade-offs

- [Risk] Node.js 24 LTS may not be installed in the execution environment used for verification. -> Mitigation: document Node.js 24 as required, configure package engines where useful, and report environment limitations if local commands cannot run.
- [Risk] Next.js and NestJS lint defaults can differ and may require separate configurations. -> Mitigation: keep lint scripts workspace-local and only aggregate them at the root.
- [Risk] Browser-side environment variables in Next.js are baked at build/start time. -> Mitigation: document that `NEXT_PUBLIC_API_BASE_URL` must be set before running or building the frontend.
- [Risk] CORS may fail if the frontend port changes. -> Mitigation: use an explicit documented `FRONTEND_ORIGIN` value instead of an implicit wildcard for development.
- [Risk] Root scripts may hide which workspace failed. -> Mitigation: delegate with npm workspace commands so command output identifies the workspace context.

## Migration Plan

CU-00 is the initial implementation baseline and has no data migration or compatibility migration.

Implementation will proceed in three increments:

1. Create root workspace structure, package metadata, baseline config, `.gitignore`, `.env.example`, and root scripts.
2. Create the Next.js frontend and NestJS Fastify backend with their TypeScript, lint, test, and build foundations.
3. Add `GET /health`, CORS, frontend health request/status UI, automated tests, builds, and documentation updates.

Rollback, if needed during implementation, is to remove the incomplete CU-00 files before commit. No persisted data or external contract exists yet.
