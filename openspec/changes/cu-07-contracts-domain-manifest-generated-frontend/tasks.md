## 1. Increment 1 - Verifiable Generated API Contracts

- [x] 1.1 Define isolated generated-backend runtime harness inputs, process lifecycle, bounded diagnostics, cleanup, and prerequisite reporting; verify unavailable Java, Gradle, or backend startup fails explicitly without derived artifacts.
- [x] 1.2 Implement deterministic OpenAPI extraction and normalization from the running known generated Spring backend; verify repeated compatible runtime contracts produce a stable canonical contract representation.
- [x] 1.3 Implement generated-operation contract validation for CRUD, DTOs, validation and stable errors, pagination, sorting, filtering, search, and relationship navigation; verify missing or incompatible operations fail closed with structured evidence.
- [x] 1.4 Implement deterministic Postman Collection v2.1 derivation solely from validated OpenAPI; verify paths, methods, parameters, schemas, variables, and ordering are OpenAPI-derived with no independent route definitions.
- [x] 1.5 Execute the generated collection against the known running generated backend and add focused contract/Postman integration tests; verify actual request outcomes and bounded failure reporting.
- [x] 1.6 Run contract package checks, generated backend Gradle checks, relevant root checks, and deterministic filesystem tests; record exact outcomes without beginning Increment 2 implementation.

## 2. Increment 2 - Versioned Domain Manifest

- [x] 2.1 Create a separate manifest package with versioned serializable contracts, canonical serialization, safe exports, and structured diagnostics; verify workspace participation and deterministic output ordering.
- [x] 2.2 Implement structural projection from `RelationalModel` for entities, fields, types, relationships, aliases, validations, searchable fields, sortable fields, and declared CRUD capabilities; verify it does not consume Canonical UML or layout state.
- [x] 2.3 Implement transport projection exclusively from validated OpenAPI for operation mappings, request/response schemas, paths, methods, and query controls; verify no endpoint is recreated from relational or UML naming.
- [x] 2.4 Implement fail-closed consistency validation across relational and transport authorities; verify entity, field, relation, capability, validation, search, and sort mismatches identify both source references and expose no partial manifest.
- [x] 2.5 Add manifest unit, malformed-input, determinism, and known-fixture chain tests; verify byte-equivalent manifests for equivalent inputs and successful contract reconciliation.
- [x] 2.6 Run manifest package and relevant root checks with the executable generated-contract harness; record exact outcomes without beginning Increment 3 implementation.

## 3. Increment 3 - Generated Next.js Web Frontend

- [ ] 3.1 Verify and pin only required compatible frontend generation dependencies, then create `@examen-sw1/frontend-generator` with canonical file planning, output-root safety, manifest hashes, and Handlebars template registry; verify unsafe paths, collisions, and unstable ordering are rejected.
- [ ] 3.2 Generate an independent Next.js App Router, TypeScript, and Material UI foundation that consumes the OpenAPI-derived operation map and Domain Manifest; verify no generated source imports CASE code, Canonical UML, or manual endpoint definitions.
- [ ] 3.3 Generate responsive entity navigation, list and detail screens, CRUD forms, relation navigation, search, declared filters, pagination, sorting, and loading/error/empty states; verify templates honor only declared entity capabilities.
- [ ] 3.4 Implement form-control inference and client validation from Domain Manifest types and restrictions; verify text, number, boolean, date, date-time, enum, multiline text, and declared relationship controls without inferred unsupported fields.
- [ ] 3.5 Add generated frontend component/integration tests for contract-safe failures, CRUD interactions, responsive desktop/mobile views, and backend communication; verify an incompatible manifest or contract prevents guessed requests.
- [ ] 3.6 Materialize the known fixture frontend twice and verify equal relative paths, hashes, and generation manifest; install dependencies, run generated frontend tests and `npm run build`, and record exact versions and outcomes.
- [ ] 3.7 Run real-browser verification against the known generated Spring backend for CRUD, relationships, search, filters, pagination, sorting, loading/error/empty states, responsive layout, and console/network errors; retain reproducible evidence.
- [ ] 3.8 Run all relevant package/root checks, generated backend/frontend checks, OpenSpec strict change and main-spec validation, and `git diff --check`; update CU-07 documentation, STATUS, and HANDOFF with actual results only, without archiving or starting CU-08.
