## Why

CU-07 delivered a deterministic frontend generator, but the CASE application only exposes the persisted-project Spring ZIP. The academic demonstration needs the same saved UML project to produce a downloadable web frontend without requiring a manually running Spring server during generation.

## What Changes

- Add authenticated `POST /projects/:id/generations/frontend` orchestration that derives the existing relational model, runtime-validated Spring OpenAPI contract, Domain Manifest, and frontend ZIP from the authoritative persisted project.
- Reuse the existing generated API contracts, Domain Manifest, frontend generator, safe ZIP streaming, and project authorization patterns; do not create a second generator or reconstruct routes from Java source.
- Complete the generated frontend's local-run artifacts: `.env.example`, a concise README, and its single API base URL configuration with the documented `http://localhost:8080` default.
- Add a separate persistence-aware `Generar frontend` editor action with loading, download, duplicate prevention, and bounded error states.
- Document the urgent academic-demo exception: CU-06 corrective acceptance gates remain pending and CU-10 remains deferred; neither is completed by this fix.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `live-project-spring-generation`: authorized persisted-project generation also provides the contract-derived frontend ZIP without changing the existing Spring endpoint.
- `generated-web-frontend`: generated frontend output includes local API configuration and run instructions required to consume the generated Spring backend.

## Impact

- Affects the CASE backend generation module, frontend project API/editor action, generated frontend file plan, backend/frontend tests, and CU-07/status documentation.
- Adds existing workspace package dependencies to the CASE backend; no new external library, schema migration, UML mapping rule, N:M rule, XMI capability, or Spring CORS change is expected.
