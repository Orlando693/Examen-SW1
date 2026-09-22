## Context

CU-06's generator accepts `RelationalModel` and its harness uses a known fixture. CASE projects persist the semantic authority as `ProjectDocument.model`; layout is not generation input. This change connects those existing boundaries only.

## Decisions

### 1. Persisted project is the sole input

`POST /projects/:id/generations/spring` authenticates and authorizes the caller, loads the authoritative project, validates only `ProjectDocument.model`, derives controlled generation metadata, maps with `mapCanonicalUmlModel()`, and generates with `generateSpringProject()`. The browser never submits a UML model or output path. Generation operates on the latest persisted model; the editor disables the action while it has unsaved changes and directs the user to Save.

### 2. Controlled metadata and artifact

The backend derives a safe Java package, artifact name, group ID, and database identifiers from validated project metadata/defaults; it rejects invalid values. It creates a server-owned temporary root, uses the existing safe generator writer, validates archive entry names, creates one ZIP with the generated project root, streams it with an attachment filename, and removes temporary files in `finally` on success or failure. No CASE secrets, paths, JWTs, or permanent artifact storage are exposed.

### 3. UI and failure contract

The editor exposes `Generar backend Spring` in its existing project/editor action area. It shows ready, generating, download-started, and bounded error states, prevents duplicate submissions, sends only the active project ID, downloads the response Blob, and revokes its object URL. Backend failures are mapped to safe structured diagnostics.

### 4. Verification

Backend integration uses a persisted `Cliente`/`Pedido` UML fixture and proves ZIP content changes when its model changes; it covers auth, authorization, invalid model/metadata, archive failure, and cleanup. Frontend tests cover action state, project ID, download, error, and duplicate prevention. One focused generated-project integration extracts the returned ZIP and uses the generated wrapper/JDK harness for Gradle test/build. A manual browser-to-ZIP-to-Spring CRUD gate remains mandatory.

## Risks

- ZIP/path traversal and temp leaks are contained by server-selected roots, existing writer validation, entry validation, bounded error responses, and unconditional cleanup.
- Generation is synchronous and intentionally small-scope; queues, storage, and history are out of scope.
