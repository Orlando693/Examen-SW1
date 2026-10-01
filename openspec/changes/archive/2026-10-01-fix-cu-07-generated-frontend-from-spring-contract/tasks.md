## 1. Incremento 1 - Frontend contractual desde proyecto persistido

- [x] 1.1 Add the existing workspace package dependencies and a project-scoped backend service that authorizes, maps, extracts and validates the generated Spring OpenAPI, derives Domain Manifest, generates the frontend, archives it safely, and cleans temporary artifacts; verify focused backend service/integration tests cover valid, invalid, denied, changed-model, and cleanup paths.
- [x] 1.2 Add `POST /projects/:id/generations/frontend` with authenticated ZIP streaming, safe filename/cache headers, and bounded diagnostics; verify backend HTTP tests cover auth, ownership concealment, success ZIP content, and failure cleanup.
- [x] 1.3 Add deterministic generated `.env.example` and README artifacts with the single local API configuration boundary; verify frontend-generator deterministic output and generated-project typecheck, test, and build checks.

## 2. Incremento 2 - Editor action and verification

- [x] 2.1 Add the separate persistence-aware `Generar frontend` project API and editor action with in-flight guard, unsaved-change blocking, Blob download cleanup, and bounded error state; verify focused frontend API and AppBar tests.
- [x] 2.2 Update CU-07, STATUS, and HANDOFF with the active corrective change, the CU-06/CU-10 exception, automated evidence, and the explicit pending manual browser-to-generated-backend CRUD gate; verify documentation reflects implementation only.
- [x] 2.3 Run focused serial package/backend/frontend checks, root typecheck/lint/build where feasible, strict change/main-spec validation, and `git diff --check`; record any unrelated existing failure and retain the manual end-to-end gate pending.
- [x] 2.4 Manual gate: download backend and frontend ZIPs from CASE, run the generated Spring backend on localhost:8080 and the generated frontend on localhost:3000, and prove their CORS-enabled CRUD integration after resolving an occupied-port startup condition.
