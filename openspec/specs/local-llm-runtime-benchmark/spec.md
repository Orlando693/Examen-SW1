# local-llm-runtime-benchmark Specification

## Purpose

Defines the local model-runtime boundary and reproducible benchmark evidence required before selecting an assistant configuration for normal use.

## Requirements

### Requirement: Local provider boundary
The system SHALL obtain text-assistant interpretations through an interchangeable provider boundary that supports a deterministic test provider and a local Qwen3 1.7B quantized runtime without requiring network inference or model binaries in source control. Normal local generation SHALL use the fixed backend-owned provider timeout default of 300,000 ms; a normal browser request SHALL NOT reduce that budget.

#### Scenario: Test without a local model
- **WHEN** automated tests run without an installed model binary
- **THEN** they use deterministic provider responses and validate the same parsing and validation boundary

#### Scenario: Local runtime is unavailable
- **WHEN** the configured local runtime or model cannot be loaded
- **THEN** the system reports a safe unavailable state and does not substitute a remote provider or execute a command

#### Scenario: Normal local generation exceeds twenty seconds
- **WHEN** a normal CASE assistant generation remains active beyond 20,000 ms but completes before the backend-owned 300,000 ms deadline
- **THEN** the provider accepts its final response rather than reporting a timeout

### Requirement: Structured provider output isolation
The system SHALL treat every provider response as untrusted structured input and SHALL route it through the assistant-command decoder and validator before it can be previewed or executed.

#### Scenario: Provider attempts an unsafe output
- **WHEN** a local provider response includes prose, code, a URL, a tool invocation, or a command outside the assistant schema
- **THEN** the response is rejected before any action adapter is reached

### Requirement: Reproducible LLM benchmark record
The system SHALL provide a repeatable benchmark procedure and record the dataset version, prompts, model and quantization, runtime configuration, hardware, accuracy, safety failures, latency, RAM, VRAM when applicable, load time, and manual observations for each measured configuration. The record SHALL state the effective timeout used so measurements can be reproduced and compared.

#### Scenario: Compare configurations
- **WHEN** two local model or prompt configurations are benchmarked
- **THEN** their records identify the inputs and environment needed to reproduce and compare the measurements without inventing unmeasured metrics

#### Scenario: Benchmark includes unsafe requests
- **WHEN** the benchmark dataset includes unsupported, destructive, malformed, or unauthorized-style requests
- **THEN** the result records whether the pipeline rejected or required confirmation for each request class

### Requirement: Generation deadline ownership and cancellation
The system SHALL apply one effective generation deadline per local interpretation. The backend-owned 300,000 ms normal timeout SHALL be authoritative. An optional direct provider timeout SHALL be accepted only as an explicit controlled override for deterministic tests or approved non-normal tooling, and the effective deadline SHALL be the minimum of that override and the backend default, with one timer rather than competing timers. A caller cancellation signal SHALL remain independent of timeout policy and SHALL cancel the active generation promptly.

#### Scenario: Explicit deterministic timeout override
- **WHEN** a controlled caller supplies an explicit timeout shorter than the backend-owned normal timeout
- **THEN** the provider stops the generation at that explicit deadline and returns the structured timeout result

#### Scenario: Caller cancels without a timeout override
- **WHEN** a caller aborts the supplied cancellation signal before the effective deadline
- **THEN** the provider stops the generation and returns the structured cancellation result rather than a timeout result

#### Scenario: Runtime recovers after an abort
- **WHEN** a generation ends by effective deadline or caller cancellation
- **THEN** the provider clears the active generation state and a later interpretation can proceed under its own deadline
