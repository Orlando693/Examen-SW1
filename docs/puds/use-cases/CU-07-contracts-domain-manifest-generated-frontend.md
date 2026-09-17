# CU-07 - Contracts, Domain Manifest And Generated Web Frontend

## Objective

Create a verifiable deterministic chain from the known canonical UML fixture through the generated Spring backend, its executable OpenAPI contract, derived Postman Collection and Domain Manifest, to an independently generated Next.js App Router and Material UI frontend.

## Preconditions

- CU-06 is closed and archived as `2026-09-16-cu-06-uml-relational-spring-generator`.
- The known fixture maps deterministically and its generated Spring backend completes Gradle test and build under Java 21.
- No OpenSpec change was active before this proposal.

## Scope

- Runtime extraction and validation of generated Spring OpenAPI.
- Deterministic OpenAPI-derived Postman Collection.
- Versioned `DomainManifest` from `RelationalModel` and validated OpenAPI.
- Separate generated Next.js App Router, TypeScript, and Material UI frontend.
- Determinism, materialization, generated-project checks, and real-browser verification of the chain.

## Out Of Scope

- Changes to Canonical UML, relational mapping, Spring relational/API rules, CASE frontend/backend, Prisma, or realtime collaboration.
- AssistantCommand, LLM, natural language, voice, Flutter, XMI, image processing, AWS, and unrelated debt.

## Approved Decisions

- `RelationalModel` remains the structural authority; extracted OpenAPI is the transport authority.
- Postman is generated exclusively from OpenAPI and never maintained as an independent collection.
- `DomainManifest` is versioned, deterministic, validated, and fails closed on source disagreement.
- The generated frontend consumes OpenAPI-derived operation mappings and the Domain Manifest. It neither reads UML nor hard-codes endpoints.
- The frontend generator is an independent package, `@examen-sw1/frontend-generator`.
- This CU has three increments: verifiable contracts, Domain Manifest, and generated frontend.

## Planned Verification

- Contract extraction, validation, and Postman execution against the running known generated backend.
- Deterministic OpenAPI, Postman, Domain Manifest, and frontend materialization checks.
- Generated frontend dependency installation, tests, and production build.
- Real-browser CRUD and responsive verification against the generated backend.
- Relevant root checks and strict OpenSpec validation.

## Implementation Status

### Increment 1 - Verifiable Generated API Contracts

Completed. `@examen-sw1/generated-api-contracts` is a separate workspace that maps and materializes the known fixture through the existing Spring generator, requires Java 21, starts the generated backend on an isolated port with ephemeral H2 configuration, extracts the real springdoc `/v3/api-docs`, and persists that document only inside the temporary root for validation.

The contract validator normalizes volatile server data and fails closed when generated CRUD, request DTOs, `page`/`size`/`sort`/`search`, count, relationship navigation, or documented 201/204/400/404 responses are missing. The generated controller templates now declare the stable errors through springdoc annotations; relational mapping and API route construction rules remain unchanged.

Postman Collection v2.1 output derives only from validated OpenAPI. It has stable request ordering, OpenAPI-derived method/path/query/body values, no timestamps, absolute paths, or runtime server values, and a safe output-root writer. Focused tests execute a generated collection CRUD sequence against the running generated backend.

### Increment 2 - Domain Manifest

Not started.

### Increment 3 - Generated Frontend

Not started. No `frontend-generator` package exists.

## Automated Evidence

- `@examen-sw1/generated-api-contracts`: 5 tests PASS, including real generated Spring backend extraction, validation, Postman derivation and execution.
- Generated Spring Gradle Wrapper test/build PASS through the existing fixture harness; spring-generator has 7 tests PASS.
- Fresh root `npm test` PASS: 393/393 tests (frontend 176, backend 159, generated-api-contracts 5, relational core 10, spring generator 7, UML core 36).
- Fresh root `npm run typecheck`, `npm run lint`, and `npm run build` PASS.
- Prisma `db:generate`, `db:validate`, `db:migrate:deploy` on DEV, and `db:migrate:test` PASS with five migrations and no pending changes.
- `openspec validate cu-07-contracts-domain-manifest-generated-frontend --strict` and `openspec validate --specs --strict` PASS.

## Known Limitations And Debt

- Existing project debt remains outside CU-07 unless it directly blocks its required verification.
- Exact generated frontend dependency versions and browser harness runner will be selected only in Incremento 3 following compatibility and reproducibility checks.

## Result

Incremento 1 is complete and ready for checkpoint review. Incremento 2 requires explicit user approval.
