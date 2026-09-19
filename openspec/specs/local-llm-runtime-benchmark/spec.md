# local-llm-runtime-benchmark Specification

## Purpose

Defines the local model-runtime boundary and reproducible benchmark evidence required before selecting an assistant configuration for normal use.

## Requirements

### Requirement: Local provider boundary
The system SHALL obtain text-assistant interpretations through an interchangeable provider boundary that supports a deterministic test provider and a local Qwen3 1.7B quantized runtime without requiring network inference or model binaries in source control.

#### Scenario: Test without a local model
- **WHEN** automated tests run without an installed model binary
- **THEN** they use deterministic provider responses and validate the same parsing and validation boundary

#### Scenario: Local runtime is unavailable
- **WHEN** the configured local runtime or model cannot be loaded
- **THEN** the system reports a safe unavailable state and does not substitute a remote provider or execute a command

### Requirement: Structured provider output isolation
The system SHALL treat every provider response as untrusted structured input and SHALL route it through the assistant-command decoder and validator before it can be previewed or executed.

#### Scenario: Provider attempts an unsafe output
- **WHEN** a local provider response includes prose, code, a URL, a tool invocation, or a command outside the assistant schema
- **THEN** the response is rejected before any action adapter is reached

### Requirement: Reproducible LLM benchmark record
The system SHALL provide a repeatable benchmark procedure and record the dataset version, prompts, model and quantization, runtime configuration, hardware, accuracy, safety failures, latency, RAM, VRAM when applicable, load time, and manual observations for each measured configuration.

#### Scenario: Compare configurations
- **WHEN** two local model or prompt configurations are benchmarked
- **THEN** their records identify the inputs and environment needed to reproduce and compare the measurements without inventing unmeasured metrics

#### Scenario: Benchmark includes unsafe requests
- **WHEN** the benchmark dataset includes unsupported, destructive, malformed, or unauthorized-style requests
- **THEN** the result records whether the pipeline rejected or required confirmation for each request class
