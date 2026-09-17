## Context

CU-06 already provides deterministic `CanonicalUmlModel -> RelationalModel -> Spring Backend` generation, including a known fixture and Java 21/Gradle verification. The generated backend has springdoc configuration, but CU-06 deliberately did not materialize OpenAPI, Postman, Domain Manifest, or a generated frontend. See `proposal.md` and the three delta specifications for required behavior.

## Goals / Non-Goals

**Goals:**
- Establish an executable, contract-first generation chain from the known generated backend to a generated web client.
- Keep relational semantics authoritative in `RelationalModel`, transport semantics authoritative in extracted OpenAPI, and consumer-facing declared capabilities authoritative in `DomainManifest`.
- Keep every generated artifact deterministic, independently testable, and materialized only below an explicit output root.

**Non-Goals:**
- Changing UML mapping, Spring persistence/API semantics, CASE services, or realtime behavior.
- Implementing AssistantCommand, language-model parsing, voice, Flutter, deployment, or business-specific frontend customization.
- Treating Postman or frontend templates as alternate API authorities.

## Decisions

### Contract extraction is runtime-backed

The harness will materialize the known Spring project, start it with isolated test configuration, retrieve its springdoc OpenAPI endpoint, and normalize/validate the result before derived generation. Runtime extraction is selected over rendering an assumed document from templates because the running backend is the observable contract. Static template inspection remains a focused unit-test aid, not contract authority.

### OpenAPI is the sole source of Postman transport definitions

A dedicated contract package will normalize OpenAPI into an ordered internal representation and generate Postman Collection v2.1 content from it. Postman will contain environment variables for runtime base URL and test data, never independently authored route, method, parameter, or schema decisions. Generating collections from `RelationalModel` was rejected because it would duplicate transport conventions.

### Domain Manifest joins two bounded authorities

A standalone manifest package will accept only `RelationalModel` and validated OpenAPI. Relational input supplies entity, field, type, constraint, and relationship facts; OpenAPI supplies operation and request/response/query mappings. A validator will fail closed on absent or contradictory coverage. Direct Canonical UML input was rejected because it bypasses CU-06 mapping decisions; OpenAPI-only derivation was rejected because it cannot authoritatively represent all structural relational semantics.

### Generated frontend uses contract mappings, not handwritten routes

`@examen-sw1/frontend-generator` will render a self-contained project using Handlebars, a canonical file plan, and explicit output-root safety checks consistent with the Spring generator. Its generated API layer will consume a generated, contract-derived operation map or client source. Screen templates consume `DomainManifest` for navigation, labels, controls, and declared capabilities. A separate package prevents coupling generated application dependencies to the CASE frontend.

### Verification uses one known fixture chain

The CU-06 known canonical fixture remains the starting point. A CU-07 harness will map, generate, build, start, extract OpenAPI, derive Postman and Domain Manifest, generate the web project twice, and verify filesystem equality, generated frontend tests/build, and browser behavior against the generated backend. This avoids an untested synthetic contract diverging from the actual backend.

## Risks / Trade-offs

- [Starting a Spring backend and frontend increases test duration and toolchain sensitivity] -> Bound processes and timeouts, capture concise diagnostics, clean isolated output roots, and fail explicitly when Java, Gradle, Node, or browser prerequisites are unavailable.
- [springdoc output can contain non-deterministic server metadata] -> Normalize only documented volatile transport-independent fields before deterministic derivation while retaining semantic validation of the raw runtime contract.
- [OpenAPI may not expose a relational fact needed by the client] -> Keep that fact in `RelationalModel` through the Domain Manifest; do not infer it from names or schema guesses.
- [Generated frontend dependencies can become expensive or drift] -> Pin only required compatible dependencies, keep generator dependencies separate, and verify lockfile integrity and generated clean install.
- [Browser checks may mask API failures] -> Require contract extraction and generated frontend automated checks before browser verification, and record browser console/network evidence separately.

## Migration Plan

1. Add the new packages and root workspace integration without changing existing package public contracts.
2. Add the known-fixture runtime harness and derived artifacts under isolated temporary output roots.
3. Add the frontend generator and generated-project verification.
4. If a generated artifact cannot be reconciled, stop at the failing contract boundary; rollback is removal of the new packages and generated output only, with no persisted schema or API migration required.

## Open Questions

- The exact generated frontend package versions and the browser harness runner will be selected during implementation after compatibility and reproducibility checks; this does not alter the contract-first approach or required verification.
