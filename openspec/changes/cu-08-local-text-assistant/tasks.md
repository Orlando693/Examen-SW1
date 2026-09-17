## 1. Incremento 1 - Assistant Command Foundation

- [x] 1.1 Create `@examen-sw1/assistant-core` with closed versioned UML-focused `AssistantCommand` types, strict decoder, bounded fields, structured diagnostics, and deterministic rule-based provider; verify unit tests reject unknown operations, keys, URLs, code, and malformed values.
- [x] 1.2 Create a deterministic serializable `AssistantModelContext`, canonical ID/name resolution, ambiguity results, and read-only `summarize_model`; verify unit tests cover valid IDs, unique names, no match, duplicate names, and side-effect-free summaries.
- [x] 1.3 Implement immutable preview, cancel, stale-revision, destructive-confirmation, permission-evaluation, and apply contracts; verify tests prove previews do not mutate and rejected requests do not reach an adapter.
- [x] 1.4 Implement `AssistantCommand` to existing `UmlCommand` adaptation and apply only through `UmlCommandBus`; verify create/rename/delete class, attribute, and relationship cases use the bus and preserve the original document.
- [x] 1.5 Add the shared package to root checks without model binaries or LLM dependencies; verify its focal test, typecheck, lint, and build pass.

## 2. Incremento 2 - Generated Application And Local Runtime (NOT STARTED)

- [ ] 2.1 Implement generated-application command resolution exclusively from `DomainManifest`; verify fixture tests cover aliases, CRUD capabilities, fields, types, relationships, invalid declarations, and no arbitrary paths.
- [ ] 2.2 Implement the generated-application execution adapter through existing authenticated API contracts; verify integration tests preserve authorization failures and never expose tokens to provider input/output.
- [ ] 2.3 Implement UML intent resolution to existing typed `UmlCommand` values and execution through `UmlCommandBus`; verify UML core tests cover accepted commands, invalid targets, semantic rejection, and unchanged documents on failure.
- [ ] 2.4 Revalidate authorization and target state immediately before apply; verify tests reject stale previews and destructive commands lacking explicit confirmation.

## 3. Incremento 3 - User Experience And Benchmark (NOT STARTED)

- [ ] 3.1 Add the node-llama-cpp local provider configuration and Qwen3 1.7B quantized model loading boundary without tracking model binaries; verify unavailable runtime produces a safe non-executing state and no remote fallback.
- [ ] 3.2 Add the text assistant UI with input, safe unavailable state, preview, diagnostics, review/apply/cancel, and destructive confirmation; verify React Testing Library coverage for the interaction states.
- [ ] 3.3 Integrate the assistant with generated-application and CASE editor contexts without bypassing their existing routes; verify browser acceptance covers valid execution, cancellation, invalid intent, authorization denial, and UML mutation through the command bus.

## 4. Documentation And Verification

- [x] 4.1 Update `docs/puds/use-cases/CU-08-local-text-assistant.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` with Incremento 1 evidence and explicit later-increment boundaries; verify documentation distinguishes planned work from completed work.
- [x] 4.2 Run focal assistant-core and required root, Prisma, OpenSpec, and whitespace validation; verify all applicable non-browser checks pass with no unexpected skips.
