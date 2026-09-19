## Context

See `proposal.md` for motivation and the three delta specifications for behavior. CU-08 already has an authenticated, read-only text interpretation adapter followed by a review-controlled preview and the established `executeAndSync()`/`UmlCommandBus` route. CU-06 and CU-07 provide the known fixture chain, generated Spring runtime, validated OpenAPI, version-1 Domain Manifest, and deterministic Handlebars generators. No STT or Flutter package currently exists.

## Goals / Non-Goals

**Goals:**
- Add local Vosk transcription as an input adapter whose final reviewed text reuses CU-08 unchanged.
- Make STT quality evidence repeatable without treating hardware-dependent measurements as test assertions.
- Add a contract-first Flutter generator with the same output-root safety and determinism discipline as existing generators.
- Preserve root checks that run without local voice, model, Flutter, Android, or device prerequisites.

**Non-Goals:**
- Generated-application assistant execution, voice-driven autonomous actions, a second assistant command grammar, remote STT, model downloads, offline data synchronization, push notifications, iOS builds, emulators, Capacitor, XMI, vision, or AWS deployment.
- Changing `AssistantCommand`, CU-08 authorization/review rules, Spring routes, OpenAPI validation, Domain Manifest v1, relational mapping, or the CASE realtime protocol.

## Decisions

### 1. Vosk is an adapter before the existing text boundary

Introduce a small Node-only STT boundary with deterministic fixture implementation and a Vosk implementation. The browser captures audio only after an explicit user action. Recording is completed in the browser before a single authenticated upload; this CU has no live transcript stream. The backend returns only a final, presentation-only transcript or a bounded diagnostic. A final transcript is editable and requires explicit submit to the existing authenticated interpretation endpoint.

The STT boundary never imports `assistant-core` execution primitives or `uml-core`; it returns transcript status, text, timing, and bounded diagnostics only. This preserves the required flow `audio -> STT -> text -> existing CU-08 parser/interpreter -> preview -> existing command route`. Direct STT-to-command mapping was rejected because it would duplicate CU-08 validation and violate the single mutator architecture. Browser-side Vosk was rejected because the product selects Node.js bindings and host-local execution.

### 2. Recorded-complete audio contract and cancellation

The browser SHALL use `getUserMedia` and Web Audio, not `MediaRecorder`. A `MediaStreamAudioSourceNode` feeds an `AudioWorklet`; it downmixes all input channels by arithmetic mean, deterministically resamples the captured float frames to 16,000 Hz with linear interpolation, clamps each sample to `[-1, 1]`, quantizes to signed PCM 16-bit little-endian, and constructs one RIFF/WAVE file. The upload is exactly `audio/wav`, `WAVE_FORMAT_PCM` (format 1), one channel, 16,000 samples/second, 16 bits/sample, `blockAlign` 2, and `byteRate` 32,000. This avoids server-side WebM/Opus decoding, FFmpeg, and any lossy or platform-dependent backend conversion.

Recording has two independent semantic limits: duration SHALL be at most 60 seconds and the PCM `data` chunk SHALL contain at most 1,920,000 bytes. The client refuses a recording that exceeds either limit before upload. `POST /assistant/voice/transcriptions` accepts only the completed WAV body with `Content-Type: audio/wav`, the normal authenticated CASE request context, and an explicit HTTP payload limit of 2,097,152 bytes. This transport limit is independent of the PCM limit and leaves bounded room for RIFF chunk metadata; it is not derived from a fixed 44-byte header.

The backend SHALL parse RIFF/WAVE chunks sequentially and safely, including chunk sizes and required padding, rather than assuming PCM begins at byte offset 44. It SHALL fail closed with bounded diagnostics unless the RIFF/WAVE structure is valid and contains exactly the supported PCM audio: `WAVE_FORMAT_PCM` format 1, one channel, 16,000 samples/second, signed PCM 16-bit little-endian, `blockAlign` 2, `byteRate` 32,000, a declared `data` length consistent with the actual chunk, PCM bytes at most 1,920,000, and duration at most 60 seconds. It validates before passing only PCM frames to Vosk, performs no format conversion or backend resampling, and does not persist or log raw audio.

The client state machine is `idle -> requesting-permission -> recording -> processing -> final | unavailable | error`; `cancelled` is a terminal local outcome that returns to `idle`. Cancel during permission or recording stops all tracks, disconnects and closes the audio graph, drops buffered PCM, and creates no upload. Cancel during processing aborts the fetch; the backend observes request cancellation, stops recognition, discards buffered audio/transcript, and publishes no result. No cancel path invokes the text-assistant endpoint. The bounded diagnostic contract exposes only `MICROPHONE_DENIED`, `MICROPHONE_UNAVAILABLE`, `AUDIO_DURATION_EXCEEDED`, `AUDIO_SIZE_EXCEEDED`, `AUDIO_FORMAT_INVALID`, `AUDIO_UNSUPPORTED`, `MODEL_UNAVAILABLE`, `TRANSCRIPTION_EMPTY`, `TRANSCRIPTION_FAILED`, and `REQUEST_CANCELLED`; it never exposes paths, Vosk exceptions, stack traces, model internals, or raw audio.

### 3. Audio and runtime prerequisites are opt-in

Normal unit tests inject deterministic transcript results. Before any model-dependent implementation, Increment 1 resolves and records the exact externally provisioned Spanish Vosk model release, upstream source URL, license, archive and extracted-directory SHA-256 values, expected directory layout, compatible Vosk binding/Node/OS versions, and the excluded local configuration variable that points to it. No task installs, downloads, bundles, or commits the model. Vosk model location, benchmark corpus location, microphone recording, real STT smoke, and benchmark execution are explicit local commands with paths outside source control. Configuration validation reports unavailable/invalid local prerequisites safely and does not use a remote fallback.

This matches CU-08's model policy and keeps CI/root checks reliable. Bundling models or invoking live hardware in tests was rejected because it creates large, platform-specific, non-reproducible requirements.

### 4. STT benchmark reuses CU-08 preview but has independent metrics

Create a versioned STT dataset descriptor containing audio identity/checksum, reference transcript, expected normalized transcript, and expected CU-08 preview outcome. The runner measures transcription/load/first-final latency and process resource snapshots, computes declared normalized WER, then runs expected reviewed text through a deterministic non-mutating CU-08 interpretation/preview harness to calculate command success. Raw measurement JSON is bounded and written outside the source tree; committed documentation contains only a truthful sanitized summary after an actual run.

Using transcript exact-match alone was rejected because it does not measure useful command interpretation. Applying previews was rejected because benchmark evidence must not mutate a project. The existing LLM benchmark utilities inform result shape and isolation but are not coupled to Vosk runtime semantics.

### 5. Flutter generator consumes Domain Manifest plus validated OpenAPI

Create `@examen-sw1/flutter-generator`, depending on `@examen-sw1/domain-manifest` and `@examen-sw1/generated-api-contracts`. Generation first requires independently validated OpenAPI and Domain Manifest inputs and then performs a fail-closed cross-contract check. OpenAPI alone owns operation IDs, HTTP methods, paths, parameters, media types, request/response schemas, and transport status handling. Domain Manifest alone owns entity aliases, field semantics/types, UI control selection, declared CRUD capabilities, and relationship navigation. The generator rejects missing, duplicate, or incompatible entity/capability/operation mappings and never guesses a route, field, relation, or request body. Runtime API base URL is an explicit generated-app configuration value, not a generated route or a CASE setting.

It follows the existing two-stage generator approach: derive an ordered operation map solely from validated OpenAPI, render a small Flutter/Dart project with Handlebars, plan SHA-256-tracked safe relative files, then optionally materialize only under an explicit output root. The output includes Android project configuration, typed contract-derived HTTP client, mobile entity navigation, generic list/detail/form/delete screens, and deterministic generated contract JSON/source.

This CU consumes these authorities but does not modify Spring routes or OpenAPI production, Domain Manifest v1, relational mapping, generated Next.js frontend behavior, or CASE assistant/voice behavior. Reading UML or copying frontend-generator route logic would violate CU-07 authority boundaries. A generated web wrapper or Capacitor was rejected because the product requires an independent Flutter app.

### 6. Flutter verification separates deterministic checks from toolchain evidence

Generator tests validate output content, operation mappings, path safety, and repeatability using the CU-06/07 known fixture chain without Flutter. A distinct opt-in generated-project harness reports the resolved executable paths and actual versions from `flutter --version`, `dart --version`, `flutter doctor -v`, `java -version`, and `android/gradlew[.bat] --version`. On Windows it requires absolute existing `FLUTTER_ROOT`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` paths, validates `FLUTTER_ROOT\\bin\\flutter.bat`, `ANDROID_SDK_ROOT\\platform-tools\\adb.exe`, `JAVA_HOME\\bin\\java.exe`, and generated `android\\gradlew.bat`, and reports each missing component as a prerequisite failure. It uses the JDK version required by the generated Gradle wrapper/Android Gradle Plugin compatibility record, rather than assuming the Java 21 requirement of the generated Spring backend applies to Android.

Only after those checks and an explicit request does the harness run, from the generated project root, `flutter pub get`, `flutter analyze`, `flutter test`, and `flutter build apk --debug`; the Android build therefore uses the generated Gradle wrapper. It captures bounded diagnostics, removes only its own temporary output root, and records actual command outcomes. It never treats toolchain absence as a passing build.

This retains reproducible package tests while delivering the roadmap-required Android build evidence. Adding Flutter/Android installation or emulator automation to root scripts was rejected as outside the requested no-install and portable-root-check boundary.

## Risks / Trade-offs

- [Vosk package/API compatibility differs by Windows or Node version] -> pin only a verified binding during implementation, use a narrow adapter, and report initialization failure without fallback.
- [Microphone/browser transport details expose privacy or payload risks] -> retain explicit user initiation, bounded audio duration/size, cancellation, authenticated backend handling, and no raw-audio logging.
- [WER normalization can hide meaningful errors] -> version and publish normalization rules while retaining per-case raw/reference outcome in local evidence.
- [Flutter/Android builds require unavailable SDK components or network dependency resolution] -> isolate them as opt-in evidence and record prerequisite failure separately from deterministic generator correctness.
- [A minimal generated mobile UI could drift from contracts] -> derive one operation map from validated OpenAPI and fail closed on any manifest/contract disagreement.

## Migration Plan

1. Resolve and record the externally provisioned Vosk model policy before model-dependent work, then add deterministic STT contracts, fixture tests, and review-only UI/backend wiring with no automatic model startup.
2. Add the opt-in STT smoke/benchmark commands and record measured evidence only after local prerequisite verification and Increment 1 manual acceptance.
3. Add the Flutter generator, deterministic fixture-chain tests, and safe materialization.
4. Run the separate Flutter/Android harness on a prepared local toolchain and retain actual build evidence after the Increment 3 manual acceptance gate.
5. Rollback removes the new optional packages/UI entry points and generated outputs; no persisted UML, database, Spring API, or Domain Manifest migration is required.
