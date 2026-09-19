## Context

See `proposal.md` for motivation and the delta specifications for behavioral requirements. The current frontend supplies a 30,000 ms request value, while the local provider defaults to 20,000 ms and arms both values as independent timers. The benchmark used 300,000 ms and demonstrates that normal CPU inference regularly outlasts either existing UI/provider deadline.

The assistant remains a backend-hosted, authenticated, read-only interpretation boundary. `AbortSignal` already represents a separate user/request lifecycle concern, and deterministic package tests rely on short explicit timeouts.

## Goals / Non-Goals

**Goals:**
- Establish one normal generation timeout budget that is controlled by the backend and based on recorded benchmark evidence.
- Preserve distinct timeout and cancellation diagnostics and ensure the provider returns to a reusable state after either outcome.
- Retain narrow explicit timeout injection for deterministic tests and approved local benchmark/smoke tooling.
- Avoid creating a frontend configuration surface for a backend runtime constraint.

**Non-Goals:**
- Re-benchmark the model, change its model/quantization/generation parameters, add remote fallback, change streaming UX, alter the assistant command pipeline, or change UML execution and authorization.
- Define a public API timeout parameter or expose normal timeout selection to CASE editor users.
- Commit a configuration variable name, `.env.example` entry, or parsing contract before implementation reviews the project's existing backend configuration conventions.

## Decisions

### Backend owns the normal deadline

The normal provider instance uses the fixed backend default of 300,000 ms. The frontend HTTP client and request DTO omit `timeoutMs`; with the existing `whitelist` and `forbidNonWhitelisted` controller policy, a supplied HTTP `timeoutMs` is rejected. The controller and service never source a timeout override, leaving only cancellation signal/request abort behavior.

This separates browser responsiveness from hardware-dependent local inference duration. Retaining the frontend's 30,000 ms deadline was rejected because it would still abort measured normal runs. Keeping the 20,000 ms provider default was rejected because the benchmark's average TTFT alone exceeds it.

### One effective timeout, not two racing timers

The provider will derive one effective deadline before generation starts: the backend normal deadline for ordinary calls, or `min(backend default, direct internal override)` for tests and approved tooling. It will create only the timer for that effective deadline. This retains short deterministic overrides without allowing tooling to loosen the normal backend policy. Cancellation remains an independently linked abort source and must preserve cancellation rather than timeout classification when it occurs first.

Maintaining both timers was rejected because it makes outcome ownership and test timing ambiguous. A browser-provided timeout was rejected because it lets a public caller reduce local inference time.

### No configuration surface is added

This correction deliberately adds no environment variable. `LOCAL_LLM_DEFAULT_TIMEOUT_MS` is the provider's exported fixed backend default and the sole normal production source. Deployment-specific tuning requires a future, separately specified backend configuration decision; it must not be introduced through a request DTO or frontend environment value.

### Explicit overrides remain non-normal and injectable

The provider input retains an optional timeout only for direct controlled callers. Production controller/DTO/service paths for normal CASE requests will not expose or populate it. Test fixtures, smoke scripts, and benchmark runners can pass a deliberate shorter value to retain fast deterministic coverage and reproducible measurements.

Removing all overrides was rejected because it would make timeout/recovery tests slow and reduce controlled benchmark repeatability. Allowing arbitrary browser overrides was rejected because it defeats backend ownership.

## Risks / Trade-offs

- [A five-minute normal deadline holds the single-generation runtime busy longer] -> Preserve the existing busy policy, cancellation, and lifecycle recovery; document the hardware-specific trade-off rather than inventing an SLA.
- [A future backend configuration option could diverge across composition paths] -> Do not add it in this correction; require a separate specified change with one validated construction path.
- [HTTP/request cancellation may race the effective deadline] -> Test both orders and assert the returned diagnostic matches the event that first aborted the generation.
- [Benchmark results vary by hardware] -> Treat 300,000 ms as the evidence-backed default, retain the benchmark's effective-timeout record, and require a future benchmark before changing it.

## Migration Plan

1. Update the provider and backend composition so ordinary requests receive the 300,000 ms backend budget and one timer.
2. Remove the normal frontend timeout argument while retaining abort wiring.
3. Add focused deterministic tests, then run relevant workspace checks and a real-model opt-in smoke only when the local GGUF is available.
4. Deploy with the fixed default; no `.env.example` change is required.
5. Roll back by restoring the prior version; no persisted data or database migration is involved.
