## Context

See proposal.md. CU-07 already has a deterministic `DomainManifest + ValidatedOpenApiContract -> frontend-generator` pipeline. The CASE has a separate persisted-project Spring ZIP route that loads the authorized project, maps it, streams a safe ZIP, and cleans its temporary output. The OpenAPI authority is currently extracted from a temporary generated Spring runtime by `withGeneratedOpenApi()`.

## Goals / Non-Goals

**Goals:**
- Connect the persisted-project generation boundary to the existing contract-first frontend generator.
- Preserve contract authority by extracting `/v3/api-docs` from a temporary generated Spring runtime rather than deriving paths from Java templates or duplicating routes.
- Keep backend and frontend download actions separate and preserve existing Spring download behavior.

**Non-Goals:**
- Reimplement CRUD, add entity-specific UI, change relational/N:M mapping, alter generated Spring CORS unless required by the current configuration, implement XMI, or complete CU-06/CU-10 work.
- Persist generated artifacts, add a queue, or claim the final browser/manual gate as complete.

## Decisions

### Runtime OpenAPI remains the transport authority

The frontend endpoint will map the persisted canonical model, materialize a temporary Spring project with H2, start it on an isolated loopback port, retrieve and validate `/v3/api-docs`, and then derive the Domain Manifest and frontend. This reuses the exact existing contract harness and avoids a manually reconstructed contract. Requiring the demonstrator to start Spring before download is rejected because generation must be self-contained.

### One generic artifact pipeline

The CASE backend will use shared safe metadata, ZIP entry validation, temporary-root cleanup, and ZIP streaming behavior for frontend output. The existing Spring endpoint remains unchanged. A second generator or Java-source parser is rejected because it would create a competing API authority.

### Generated runtime configuration is explicit

The generated frontend will carry `.env.example` and README instructions, while its existing generated HTTP layer remains the only consumer of `NEXT_PUBLIC_API_BASE_URL` and retains the local `http://localhost:8080` fallback. Generated Spring CORS already permits localhost origins through `CORS_ALLOWED_ORIGIN_PATTERNS`; no change is needed unless verification disproves this.

### Separate editor action state

The AppBar will add a distinct frontend generation state and in-flight guard next to the existing backend action. Both require the same saved-project precondition but neither state blocks or changes the other action.

## Risks / Trade-offs

- [Temporary Spring startup increases request latency and requires Java/Gradle] -> Bound the existing harness lifecycle, return a safe generation failure, and clean temporary roots in all paths.
- [Runtime contract extraction and ZIP streaming can leak temporary files] -> Reuse the existing cleanup contract and test failures/cleanup.
- [Later CU-06 changes can fail global suites] -> Run fix-specific checks serially and report unrelated failures without modifying those changes.

## Migration Plan

1. Add contract-derived frontend orchestration and generated run artifacts without changing Spring generation behavior.
2. Add endpoint and editor download coverage for simple and association-entity project models.
3. Validate automated behavior; retain the final browser CRUD demo as a pending manual gate.
4. Rollback removes the frontend endpoint/action and leaves archived CU-07 generator packages and persisted projects unchanged.
