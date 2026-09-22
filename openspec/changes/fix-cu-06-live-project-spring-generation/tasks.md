## 1. Incremento 1 - Pipeline de proyecto persistido y ZIP

- [x] 1.1 Define controlled generation metadata/defaults and safe diagnostics for the existing mapper/generator.
- [x] 1.2 Add authenticated project-scoped orchestration that loads only authoritative `ProjectDocument.model`, validates, maps, and generates without fixture fallback.
- [x] 1.3 Materialize server-owned temporary output, create a safe complete-project ZIP response, and guarantee cleanup.
- [x] 1.4 Add backend integration coverage for authorized live UML output, changed-model output, auth/access denial, invalid model/metadata, ZIP failure, and cleanup.

## 2. Incremento 2 - Editor descarga y evidencia E2E

- [x] 2.1 Add the persistence-aware `Generar backend Spring` editor action with ready/generating/download/error states and duplicate prevention.
- [x] 2.2 Add frontend coverage for active project request, unsaved-change blocking, ZIP Blob download/resource release, bounded errors, and duplicate prevention.
- [x] 2.3 Extract one artifact from the live project-scoped flow and run the existing generated Gradle wrapper test/build harness with the required JDK.
- [x] 2.4 Run focused/root validation and strict OpenSpec checks without modifying archived CU-06.
- [x] 2.5 Manual gate: create/save Cliente/Pedido and a supported relation in the real editor, download ZIP, inspect output, run generated Gradle test/build, start Spring Boot, and prove one CRUD flow.
