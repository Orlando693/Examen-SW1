## Why

The CASE editor currently requires direct UI interaction. CU-08 adds local natural-language assistance for its UML model while preserving deterministic execution, authorization, and the canonical UML command route.

## What Changes

- Define a closed, typed UML-focused `AssistantCommand` language.
- Add a fail-closed pipeline that parses assistant output, validates declared capabilities and user input, previews the resolved action, and requires review before application.
- Adapt valid UML commands exclusively to `UmlCommand` submitted through `UmlCommandBus`.
- Add a local LLM provider boundary using node-llama-cpp and a reproducible benchmark protocol for Qwen3 1.7B quantized configurations. A deterministic mock provider keeps tests independent from local model binaries.
- Add assistant UI behavior for text input, preview, review, apply, cancel, diagnostics, and destructive-operation confirmation.

Executing CRUD operations against generated application instances is outside CU-08. `DomainManifest` remains read-only; that capability requires a separately designed command model and authenticated OpenAPI execution layer.

## Delivery Sequence

- Incremento 1 delivers the deterministic non-LLM `AssistantCommand` pipeline.
- Incremento 2 delivers the local LLM runtime boundary and its opt-in CPU smoke evidence.
- Incremento 3 delivers UI, reproducible benchmarks, browser E2E, and final acceptance evidence.

## Capabilities

### New Capabilities
- `local-text-assistant`: Closed UML textual assistant commands, validation, preview/review/apply behavior, and canonical UML adaptation.
- `local-llm-runtime-benchmark`: Local model provider requirements and reproducible benchmark evidence for assistant accuracy, safety, latency, and resource use.

### Modified Capabilities

- None.

## Impact

- Affected packages include `@examen-sw1/uml-core` and new assistant-focused shared packages or modules.
- Adds the planned `node-llama-cpp` runtime integration; model binaries, credentials, arbitrary tools, SQL, shell execution, and external URLs remain out of scope.
- Reuses existing project access control and `UmlCommandBus` contracts without weakening them.
