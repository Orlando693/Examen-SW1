## 1. Trusted Create Identity Boundary

- [x] 1.1 Remove create-entity ID fields from the local-model JSON schema projection and prompt while retaining bounded ID/name references for existing targets; verify local-llm schema and prompt tests show create branches expose no `classId`, `attributeId`, or `relationId` and retain existing reference alternatives.
- [x] 1.2 Update assistant-core create adaptation so any optional identity supplied by a complete candidate is omitted from `CreateClass`, `AddAttribute`, `CreateAssociation`, and `CreateGeneralization`; verify focused assistant-core tests show the resulting UML commands carry no model-selected creation ID.

## 2. Regression Coverage

- [x] 2.1 Add assistant-core decoder/preview/apply regressions for class, attribute, and relation creation; verify an existing-target ID remains resolvable, each creation receives a trusted unique ID, and preflight remains side-effect-free.
- [x] 2.2 Extend the deterministic test-only provider and Playwright assistant flow with a complete create-class candidate containing a colliding existing class ID; verify Apply persists exactly one new uniquely identified class and no duplicate, then cover add-attribute and create-relation using existing class references.

## 3. Verification

- [x] 3.1 Run focused assistant-core, local-llm, backend assistant, frontend unit, and Playwright assistant tests; verify all pass without Qwen/GGUF smoke or benchmark execution.
- [x] 3.2 Run root typecheck, lint, and build plus `openspec validate fix-assistant-model-owned-create-ids --strict` and `openspec validate --specs --strict`; verify the change and main specifications validate strictly.
