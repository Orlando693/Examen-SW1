## Why

CU-06 can deterministically produce and verify a Spring backend, but its API contract is not yet materialized into externally consumable artifacts and no generated web application exists. CU-07 completes the contract-to-client boundary needed to operate a generated domain visually and to provide the safe declarative input required by CU-08 assistants.

## What Changes

- Extract the OpenAPI document from a running generated Spring backend and validate its endpoints, DTOs, stable errors, and query parameters against executable behavior.
- Generate a deterministic Postman Collection exclusively from the extracted OpenAPI document; a manually maintained independent collection is prohibited.
- Introduce a versioned `DomainManifest` derived from `RelationalModel` for structural semantics and OpenAPI for transport semantics, with consistency validation between both sources.
- Add a separate `@examen-sw1/frontend-generator` package that deterministically materializes a Next.js App Router, TypeScript, and Material UI application from the generated OpenAPI and Domain Manifest.
- Generate responsive visual CRUD screens, typed controls inferred from manifest types, relationship navigation, search, filters, pagination, sorting, and loading, error, and empty states.
- Add deterministic materialization, generated-project build/test, backend integration, and real-browser verification coverage for the full known-fixture chain.

## Capabilities

### New Capabilities

- `generated-api-contracts`: Extract and validate the generated Spring OpenAPI contract and derive a deterministic Postman Collection from it.
- `domain-manifest-generation`: Generate and validate the versioned machine-readable domain manifest from relational and API authorities.
- `generated-web-frontend`: Deterministically generate and verify a responsive Next.js App Router and Material UI CRUD application from generated contracts.

### Modified Capabilities

- None.

## Impact

- Adds contract, manifest, and frontend-generator packages without changing `uml-core`, `relational-core`, the Spring generator's relational rules, CASE frontend, NestJS backend, Prisma schema, or realtime protocol.
- Requires a generated Spring backend fixture to run for executable OpenAPI and Postman verification; the existing Java 21 and generated Gradle Wrapper harness remain the backend prerequisite.
- Generated frontend output is an independent application and consumes generated OpenAPI and Domain Manifest. It does not inspect UML, recreate relational mapping, or hard-code endpoint routes.
- Excludes AssistantCommand, LLMs, natural-language interpretation, voice, Flutter, XMI, image processing, AWS deployment, and unrelated technical debt.
