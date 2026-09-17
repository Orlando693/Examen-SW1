## Why

The generated application and CASE editor currently require direct UI interaction. CU-08 adds local natural-language assistance while preserving deterministic execution, authorization, and the canonical UML command route.

## What Changes

- Define a closed, typed `AssistantCommand` language for `LIST`, `GET`, `SEARCH`, `CREATE`, `UPDATE`, `DELETE`, and `COUNT`.
- Add a fail-closed pipeline that parses assistant output, validates declared capabilities and user input, previews the resolved action, and requires review before application.
- Use `DomainManifest` only as read-only structured context and declared-capability validation; adapt valid UML commands exclusively to `UmlCommand` submitted through `UmlCommandBus`.
- Add a local LLM provider boundary using node-llama-cpp and a reproducible benchmark protocol for Qwen3 1.7B quantized configurations. A deterministic mock provider keeps tests independent from local model binaries.
- Add assistant UI behavior for text input, preview, review, apply, cancel, diagnostics, and destructive-operation confirmation.

## Capabilities

### New Capabilities
- `local-text-assistant`: Closed textual assistant commands, validation, preview/review/apply behavior, and adapters for generated applications and canonical UML.
- `local-llm-runtime-benchmark`: Local model provider requirements and reproducible benchmark evidence for assistant accuracy, safety, latency, and resource use.

### Modified Capabilities

- None.

## Impact

- Affected packages include the generated application frontend/backend integration, `@examen-sw1/domain-manifest`, `@examen-sw1/uml-core`, and new assistant-focused shared packages or modules.
- Adds the planned `node-llama-cpp` runtime integration; model binaries, credentials, arbitrary tools, SQL, shell execution, and external URLs remain out of scope.
- Reuses existing authentication, project access control, `DomainManifest`, and `UmlCommandBus` contracts without weakening them.
