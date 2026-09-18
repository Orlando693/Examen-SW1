## Context

See `proposal.md` for motivation and the two delta specifications for behavior. `@examen-sw1/uml-core` already supplies typed commands, semantic validation, and `UmlCommandBus`. Existing project mutations already establish authorization boundaries.

## Goals / Non-Goals

**Goals:**
- Keep model interpretation separate from deterministic command decoding, validation, preview, and execution.
- Reuse the CASE editor's command bus instead of creating assistant-specific mutation paths.
- Allow all automated tests to run without LLM binaries or GPU hardware.
- Produce evidence suitable for selecting a local Qwen3 1.7B quantization and runtime configuration.

**Non-Goals:**
- Voice/STT, image input, XMI, cloud inference, autonomous execution, arbitrary tool use, code execution, SQL generation, or a new authorization model.
- Changing relational mapping, generated API contracts, generated-application instance CRUD, existing `UmlCommand` semantics, or realtime collaboration behavior.

## Decisions

### Increment sequencing

Incremento 1 contains the deterministic command pipeline. Incremento 2 contains the local `node-llama-cpp` runtime boundary, local GGUF configuration, and opt-in runtime evidence. Incremento 3 contains the assistant UI, benchmark protocol execution, browser E2E, and final acceptance evidence.

This sequencing keeps model loading and its fail-closed provider contract available before any UI exposes it, while preserving UI and benchmark acceptance as later work.

### Closed command intermediate representation

Define an `AssistantCommand` decoder with a discriminated, bounded schema covering only the seven roadmap operations. It carries intent and typed arguments, never URLs, SQL, code, or executable callbacks. The decoder rejects unknown keys and discriminators before validation.

This separates fallible natural-language interpretation from deterministic behavior. A free-form action object was rejected because it would expand the attack surface and make fixtures non-deterministic.

### UML validation and adaptation

Use one pipeline: provider response -> strict assistant decoder -> UML validator/resolver -> preview -> explicit approval -> adapter -> existing executor. UML validation resolves current canonical elements and produces only existing `UmlCommand` variants for `UmlCommandBus`.

This avoids giving the LLM direct access to persistence or domain internals. A direct Prisma/REST/React Flow integration was rejected because it bypasses established validation, authorization, or canonical mutation routes. `DomainManifest` remains read-only and has no execution role in CU-08; generated-application CRUD requires a separately designed command and authenticated OpenAPI execution layer.

### Preview is a durable boundary, not model output

The preview presents a normalized summary, resolved target, values, diagnostics, and confirmation requirement. Apply operates on the validated preview identity or immutable normalized command, not the original text or a later provider response. A new request invalidates any prior pending preview.

This prevents text/model drift between review and execution. Automatic execution was rejected because CU-08 explicitly requires review and destructive confirmation.

### Local provider and test provider

Introduce a provider interface with a deterministic fixture/mock implementation and a node-llama-cpp implementation for Qwen3 1.7B quantized GGUF. Transformers.js is considered only for an explicitly justified local preprocessing or retrieval role; it is not a second command executor. Runtime configuration and model locations are local configuration, and model binaries remain untracked.

This delivers the selected local stack while preserving reproducible tests. A remote fallback was rejected because offline-first behavior and local privacy are mandatory.

### Benchmark as versioned fixtures and results

Keep a versioned, non-secret benchmark dataset of expected accepted/rejected intents and a runner that emits machine-readable measurements plus a human-reviewed report. No benchmark assertion claims hardware-dependent metric thresholds; results are recorded from actual runs.

This makes configuration comparison repeatable without inventing metrics. Ad hoc manual testing was rejected because it cannot compare models, prompts, or hardware reliably.

## Risks / Trade-offs

- [Small local models can emit invalid JSON or hallucinated fields] -> Strict decoding, manifest/UML validation, preview, and deterministic mocks cover all execution paths.
- [Qwen runtime setup differs across operating systems and hardware] -> Runtime remains optional for tests, reports unavailable state safely, and benchmark records exact environment/configuration.
- [Composite requests can hide partial side effects] -> Initial implementation limits plans to a bounded sequence, validates each step, previews the whole plan, and stops on first failure without automatic compensating actions.
- [Manifest or editor state can change after preview] -> Revalidate resolved targets and authorization immediately before apply; stale previews require a new preview.
- [Sensitive natural-language content could enter logs] -> Avoid recording raw prompts or tokens by default; benchmark fixtures use synthetic data only.

## Migration Plan

1. Add assistant modules and deterministic tests behind no automatic startup or runtime-model requirement.
2. Expose the assistant UI only where the matching manifest or UML context is present, preserving all existing manual actions.
3. Enable a local model only through explicit local configuration after a documented benchmark run; absence or failure leaves the assistant unavailable rather than falling back remotely.
4. Rollback consists of disabling the assistant entry point/configuration; no persisted model or data migration is required.

## Open Questions

- The final Qwen3 GGUF quantization depends on benchmark evidence from the target demonstration hardware; this does not change the provider boundary or command contract.
