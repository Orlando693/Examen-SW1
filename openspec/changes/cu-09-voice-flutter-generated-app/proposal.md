## Why

CU-08 provides a reviewed, text-to-UML-command pipeline, but the academic delivery still requires a local reviewed voice input and reproducible STT evidence. The original CU-09 scope also included an independent Flutter mobile client; it is explicitly deferred before implementation and is not accepted by this change.

## What Changes

- Add local Spanish Vosk speech-to-text behind a Node.js boundary, with explicit microphone/audio capture, transcript display, correction, submit, cancellation, and unavailable-state behavior.
- Route only a user-reviewed transcript into the existing authenticated CU-08 interpretation and preview pipeline. STT does not decode, resolve, execute, or mutate UML commands.
- Add a versioned, reproducible, opt-in STT benchmark protocol with normalized WER, command success, latency, resource measurements, and recorded manual edge-case observations.
- Preserve the original Flutter planning record as deferred future work. No Flutter generator, Android build, or Flutter acceptance criterion is active for this academic delivery.

## Capabilities

### New Capabilities
- `local-speech-to-text`: Local Spanish Vosk transcription with review-controlled handoff to the existing CASE text-assistant pipeline.
- `local-stt-runtime-benchmark`: Versioned reproducible local STT benchmark records and measurement rules.
- `generated-flutter-mobile`: Deferred before implementation; retained only as the historical original scope.

### Modified Capabilities
- None.

## Impact

- Planned affected areas are a framework-independent STT package or module, backend voice adapter and CASE assistant UI integration, benchmark fixtures/tooling, root workspace scripts, and CU-09/status documentation.
- Vosk Node bindings and an externally provisioned Spanish model are runtime prerequisites only; no model binary, microphone access, remote inference, or model download is required by root tests.
- Flutter output was planned to consume Spring OpenAPI and Domain Manifest semantics, but is deferred before implementation and no Flutter completion is claimed.
