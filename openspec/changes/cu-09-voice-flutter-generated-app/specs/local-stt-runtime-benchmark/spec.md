## Purpose

Defines repeatable and truthful benchmark evidence for local Spanish speech-to-text configurations used with short CASE assistant commands.

## ADDED Requirements

### Requirement: Versioned reproducible STT benchmark inputs
The system SHALL define a versioned benchmark dataset of synthetic Spanish command audio references, reference transcripts, expected reviewed-text command outcomes, model identity/integrity metadata, and runtime configuration. Model metadata SHALL reference the externally resolved Vosk release, source, license, archive and extracted-directory SHA-256 values, expected layout, and compatible binding/Node/OS versions. The benchmark procedure SHALL preserve input provenance and SHALL not require benchmark audio or models to be committed when their size or licensing prevents that.

#### Scenario: Repeat a recorded configuration
- **WHEN** a measured STT configuration is run again with the declared dataset version and local prerequisites
- **THEN** the record identifies the model, configuration, audio inputs, and environment needed to reproduce and compare the measurement

### Requirement: STT benchmark measures normalized WER and command success
The benchmark SHALL calculate normalized word error rate against each declared reference transcript and command success by submitting the expected reviewed transcript through the existing non-mutating CU-08 interpretation/preview boundary. Normalization rules and aggregate denominators SHALL be recorded with the result.

#### Scenario: Recognized transcript differs only in normalized form
- **WHEN** a recognized transcript differs from its reference only by declared normalization rules
- **THEN** WER and command-success evaluation use the declared normalized representation without concealing unnormalized evidence

#### Scenario: Transcription cannot yield the expected command preview
- **WHEN** a recognized or reviewed transcript does not produce its expected safe preview, clarification, or rejection outcome
- **THEN** the benchmark records that case as command-unsuccessful and does not execute a UML mutation

### Requirement: STT benchmark records measured operational evidence
Each measured benchmark record SHALL report actual per-case and aggregate latency, model load time, CPU/RAM and VRAM when applicable, failures, normalized WER, command success, hardware/runtime details, and manual edge-case observations. It SHALL distinguish not measured from zero and SHALL not invent thresholds or observations.

#### Scenario: Run without GPU telemetry
- **WHEN** the measured STT runtime does not use or expose GPU memory
- **THEN** the record marks VRAM as not applicable or not measured rather than reporting a fabricated value

### Requirement: STT benchmark is opt-in and bounded
The real benchmark SHALL run only through an explicit opt-in command with locally supplied model and dataset locations, write raw results outside the repository source tree, enforce bounded output size, and avoid recording user audio or private transcripts by default.

#### Scenario: Root checks run in a clean development environment
- **WHEN** root test, lint, typecheck, or build commands run without STT assets
- **THEN** they do not invoke a microphone, load a Vosk model, run the real benchmark, or download audio/model artifacts

### Requirement: Benchmark acceptance evidence is manual and truthful
The system SHALL require a manual Increment 2 review of the declared model, dataset, normalization/configuration, and sanitized durable record before treating benchmark evidence as accepted. When local prerequisites exist, the reviewer SHALL reproduce at least one selected case; when they do not, the record SHALL identify the exact blocker and SHALL not claim a benchmark result.

#### Scenario: Benchmark prerequisite is unavailable
- **WHEN** the selected model, dataset, or compatible local runtime is unavailable for the manual review
- **THEN** the record marks the benchmark evidence as blocked or not run with the exact missing prerequisite, rather than marking it passed
