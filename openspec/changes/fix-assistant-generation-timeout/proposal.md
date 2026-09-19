## Why

The CASE assistant's frontend sends a 30,000 ms timeout while the local provider defaults to 20,000 ms and starts both timers. The effective 20-second deadline aborts normal local generations: the completed benchmark used 300,000 ms and measured 88.7 s average time to first token, 135.4 s average total time, and 202.8 s maximum total time.

This correction restores a timeout budget supported by measured evidence while preserving explicit cancellation and short deterministic test cases.

## What Changes

- Make the local LLM provider's normal production timeout backend-owned, with a fixed default of 300,000 ms.
- Stop the normal CASE assistant frontend request from imposing its own timeout deadline; it continues to pass a cancellation signal.
- Remove `timeoutMs` from the production HTTP DTO and frontend client contract. Extra HTTP request fields, including `timeoutMs`, are rejected by the controller DTO policy.
- Preserve an optional direct provider timeout only for explicit internal test and benchmark/smoke tooling. It can shorten, but never extend, the backend deadline.
- Ensure concurrent configured and explicit timeouts use one effective deadline rather than independently competing timers.
- Define tests for default completion budget, explicit timeout override, caller cancellation, recovery after abort, and the frontend-to-backend request contract.
- Keep the provider default as the sole normal backend policy; this correction adds no environment setting or frontend runtime configuration.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `local-llm-runtime-benchmark`: Changes local-provider timeout ownership, normal default behavior, controlled overrides, cancellation semantics, and benchmark evidence requirements.
- `local-text-assistant`: Changes the CASE editor interpretation request contract so normal requests do not provide a frontend generation timeout while retaining cancellation.

## Impact

- Affected areas are `@examen-sw1/local-llm`, the authenticated backend assistant adapter/provider wiring, the CASE assistant frontend request client, and their unit, integration, and browser-contract tests.
- No model binary, remote inference, command schema, authorization, UML mutation path, persistence schema, API route, or generated-application behavior changes.
- No model binary, benchmark prompt/output, or generation/sampling/grammar setting is changed.
