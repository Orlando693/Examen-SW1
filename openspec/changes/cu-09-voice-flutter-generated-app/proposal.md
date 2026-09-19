## Why

CU-08 provides a reviewed, text-to-UML-command pipeline and CU-07 provides verified generated Spring contracts, but the product still lacks its required local voice input and independent Flutter mobile client. CU-09 completes those two transition capabilities without creating an alternate mutation path or a Capacitor application.

## What Changes

- Add local Spanish Vosk speech-to-text behind a Node.js boundary, with explicit microphone/audio capture, transcript display, correction, submit, cancellation, and unavailable-state behavior.
- Route only a user-reviewed transcript into the existing authenticated CU-08 interpretation and preview pipeline. STT does not decode, resolve, execute, or mutate UML commands.
- Add a versioned, reproducible, opt-in STT benchmark protocol with normalized WER, command success, latency, resource measurements, and recorded manual edge-case observations.
- Add deterministic Handlebars-based Flutter/Dart project generation from the existing validated OpenAPI and Domain Manifest contracts, producing a minimal independent REST CRUD client and an Android build target.
- Add generator and opt-in verification plans that keep root automated tests independent from Vosk models, microphones, Android SDKs, Flutter SDKs, and generated-project downloads.

## Capabilities

### New Capabilities
- `local-speech-to-text`: Local Spanish Vosk transcription with review-controlled handoff to the existing CASE text-assistant pipeline.
- `local-stt-runtime-benchmark`: Versioned reproducible local STT benchmark records and measurement rules.
- `generated-flutter-mobile`: Deterministic Flutter generation from validated generated-application contracts and Android build evidence.

### Modified Capabilities
- None.

## Impact

- Planned affected areas are a new framework-independent STT package or module, backend voice adapter and CASE assistant UI integration, benchmark fixtures/tooling, a separate Flutter generator workspace, root workspace scripts, and CU-09/status documentation at implementation time.
- Vosk Node bindings and an externally provisioned Spanish model are runtime prerequisites only; no model binary, microphone access, remote inference, or model download is required by root tests.
- Flutter output consumes existing Spring OpenAPI transport mappings and Domain Manifest semantics, remains independent from the generated Next.js frontend and CASE application, and targets Android without Capacitor.
