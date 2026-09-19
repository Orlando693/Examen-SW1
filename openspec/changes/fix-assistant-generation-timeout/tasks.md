## 1. Timeout Ownership

- [x] 1.1 Implement the local provider's single fixed backend normal-timeout source with a 300,000 ms default; do not add an environment setting or frontend runtime configuration.
- [x] 1.2 Change the local provider to compute one effective deadline for each interpretation: the backend default normally, or the minimum of that default and a direct controlled internal override; verify no second competing timer remains.
- [x] 1.3 Preserve linked caller-signal cancellation independently from the effective deadline and verify timeout versus cancellation diagnostics and lifecycle cleanup through focused provider tests.

## 2. CASE Request Contract

- [x] 2.1 Remove the normal frontend CASE assistant generation-timeout argument while retaining request abort/cancel behavior, and verify the authenticated backend controller/service path never sources a per-request timeout.
- [x] 2.2 Keep timeout injection limited to direct deterministic tests and approved benchmark/smoke callers; verify no production request DTO or frontend runtime configuration exposes it and HTTP `timeoutMs` is rejected by DTO policy.

## 3. Automated Evidence

- [x] 3.1 Add or update `@examen-sw1/local-llm` tests for the 300,000 ms default, explicit short override, caller cancellation, timeout/cancellation race classification, and successful interpretation after each abort; run the local-llm test workspace.
- [x] 3.2 Add or update backend assistant-provider/service/controller tests for the fixed backend default, normal request omission, and DTO/controller rejection of `timeoutMs`; run the backend assistant-focused test suite.
- [x] 3.3 Add or update frontend component/request tests for omission of the normal timeout and cancellation preservation; run the frontend assistant-focused tests.
- [x] 3.4 Do not run the GGUF/Qwen smoke or benchmark for this correction; record that it was intentionally not run and do not fabricate evidence.
- [x] 3.5 Run relevant workspace tests plus root typecheck, lint, and build; run `openspec validate fix-assistant-generation-timeout --strict` and `openspec validate --specs --strict` and resolve failures.

## 4. Documentation And Closure Evidence

- [x] 4.1 Update the CU-08 correction record with the fixed backend default, direct-only override/minimum behavior, HTTP rejection, timeout/cancellation behavior, tests, and the intentionally not-run smoke; do not update `.env.example`.
- [x] 4.2 Before requesting acceptance, update STATUS/HANDOFF as applicable with the correction state and run `git diff --check`; verify no model binary, secret, benchmark prompt, or raw benchmark output is added.
