## 1. Incremento 1 - Assistant Command Foundation

- [x] 1.1 Create `@examen-sw1/assistant-core` with closed versioned UML-focused `AssistantCommand` types, strict decoder, bounded fields, structured diagnostics, and deterministic rule-based provider; verify unit tests reject unknown operations, keys, URLs, code, and malformed values.
- [x] 1.2 Create a deterministic serializable `AssistantModelContext`, canonical ID/name resolution, ambiguity results, and read-only `summarize_model`; verify unit tests cover valid IDs, unique names, no match, duplicate names, and side-effect-free summaries.
- [x] 1.3 Implement immutable preview, cancel, stale-revision, destructive-confirmation, permission-evaluation, and apply contracts; verify tests prove previews do not mutate and rejected requests do not reach an adapter.
- [x] 1.4 Implement `AssistantCommand` to existing `UmlCommand` adaptation and apply only through `UmlCommandBus`; verify create/rename/delete class, attribute, and relationship cases use the bus and preserve the original document.
- [x] 1.5 Add the shared package to root checks without model binaries or LLM dependencies; verify its focal test, typecheck, lint, and build pass.

## 2. Incremento 2 - Local LLM Runtime (ACTIVE / PARTIAL)

- [x] 2.1 Add `@examen-sw1/local-llm` with the node-llama-cpp provider boundary, model-path diagnostics, bounded context/prompt construction, lifecycle state, lazy load/reuse/dispose, and fail-closed decoding through `assistant-core`; verify deterministic local package tests pass without a model binary.
- [x] 2.2 Verify the authorized local Qwen3 1.7B Q4_K_M GGUF on the target Windows x64 CPU prebuilt; record exact model integrity, successful load, CPU fallback behavior, and opt-in read-only `summarize_model` smoke evidence outside source control.
- [x] 2.3 Complete the closed JSON-schema grammar for every supported `AssistantCommand` shape and verify valid mutation-shaped output, malformed/unsafe output rejection, and decoder isolation.
- [x] 2.4 Verify timeout, explicit cancellation, streaming callback, and single-generation busy policy with deterministic runtime tests and real-runtime evidence where safe.
- [x] 2.5 Complete UML intent resolution to existing typed `UmlCommand` values and execution through `UmlCommandBus`; verify UML core tests cover accepted commands, invalid targets, semantic rejection, and unchanged documents on failure.
- [x] 2.6 Revalidate authorization and target state immediately before apply; verify tests reject stale previews and destructive commands lacking explicit confirmation.

### Deferred capability outside CU-08

Generated-application CRUD resolution and authenticated API execution are OUT OF SCOPE / DEFERRED FROM CU-08. They require a distinct application-data command model, OpenAPI operation resolution, DTO mapping, endpoint selection, authenticated execution, and generated-application authorization semantics. `DomainManifest` remains read-only and cannot supply that execution layer. This capability requires a separately approved future proposal/change.

## 3. Incremento 3 - User Experience, Benchmark, And E2E (PARTIAL)

- [x] 3.1 Add the text assistant UI with input, loading/model-unavailable state, streaming presentation, preview, diagnostics, review/apply/cancel, clarification, and destructive confirmation; verify React Testing Library coverage for the interaction states.
- [x] 3.2 Add a versioned reproducible benchmark dataset and runner; record quality, safety, latency, resource, and manual-observation evidence without inventing metrics. The complete measured 2026-09-18 Qwen CPU record uses dataset `assistant-command-v1-case-uml-2026-09-18`, Qwen3-1.7B-Q4_K_M at context 2048, and is summarized without prompts or chain-of-thought in the CU-08 record.
- [x] 3.3 Integrate the assistant only with the CASE/UML editor through an authenticated read-only interpretation adapter and existing editor routes; verify browser E2E covers valid execution, cancellation, invalid intent, authorization denial, ambiguity without silent mutation, and UML mutation through the command bus. Generated-application assistant integration remains deferred outside CU-08.

## 4. Documentation And Verification

- [x] 4.1 Update `docs/puds/use-cases/CU-08-local-text-assistant.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` with Incremento 1 evidence and explicit later-increment boundaries; verify documentation distinguishes planned work from completed work.
- [x] 4.2 Run focal assistant-core and required root, Prisma, OpenSpec, and whitespace validation; verify all applicable non-browser checks pass with no unexpected skips.
