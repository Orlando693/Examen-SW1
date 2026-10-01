## Purpose

Provides local Spanish speech transcription for the CASE assistant while retaining the existing reviewed text-command pipeline as the only path toward UML actions.

## ADDED Requirements

### Requirement: Local Spanish transcription boundary
The system SHALL transcribe bounded user audio using Vosk through local Node.js bindings and an externally provisioned Spanish model. Before model-dependent implementation, it SHALL record the exact model release, source, license, archive and extracted-directory SHA-256 values, expected directory layout, compatible binding/Node/OS versions, and excluded local configuration path. It SHALL not send audio or transcripts to a remote inference service, download, install, include, or bundle a model binary in source control, or require a microphone or model installation for normal automated tests.

#### Scenario: Local STT is unavailable
- **WHEN** the configured local model is absent, unreadable, incompatible, or cannot initialize
- **THEN** the system reports a safe unavailable state and does not substitute a remote transcription provider

#### Scenario: Automated tests run without STT prerequisites
- **WHEN** normal automated tests run without a Vosk model, microphone, or audio device
- **THEN** deterministic transcription fixtures exercise the same bounded transcription-result contract

### Requirement: Transcript review is required before interpretation
The system SHALL display the final transcript for explicit user review and correction before it is submitted as text to the existing authenticated CU-08 interpretation endpoint. Partial transcripts are presentation-only and SHALL not be submitted automatically.

#### Scenario: User corrects a transcript
- **WHEN** transcription returns a final transcript and the user edits its text
- **THEN** only the corrected reviewed text is sent to the existing text-assistant interpretation boundary

#### Scenario: User cancels transcription or review
- **WHEN** the user cancels an active transcription or discards a reviewed transcript
- **THEN** no text interpretation request, preview, or UML action is created

### Requirement: Completed WAV audio contract
The system SHALL capture completed audio in the browser using `getUserMedia` and Web Audio, downmix channels by arithmetic mean, linearly resample to 16,000 Hz, clamp and quantize to PCM16LE, and upload one RIFF/WAVE PCM file. It SHALL not use `MediaRecorder`, upload WebM/Opus, require FFmpeg, or perform backend audio conversion or resampling. The accepted upload SHALL be authenticated `POST /assistant/voice/transcriptions` with `Content-Type: audio/wav` and an HTTP payload limit of 2,097,152 bytes. This transport limit is independent from the semantic limits: PCM `data` bytes SHALL be at most 1,920,000 and duration SHALL be at most 60 seconds. The backend SHALL parse RIFF chunks with size and padding awareness, without assuming `data` begins at byte offset 44, and fail closed unless the RIFF/WAVE structure is valid and its PCM audio is format 1, mono, 16,000 samples/second, signed PCM 16-bit little-endian, 16 bits/sample, block alignment 2, byte rate 32,000, and has a declared `data` length consistent with the actual chunk.

#### Scenario: Completed audio is valid
- **WHEN** a user stops a recording within the PCM-byte and duration semantic limits and the independent HTTP payload limit
- **THEN** the browser uploads one completed WAV and the backend parses its RIFF/WAVE chunks and validates its PCM payload before passing PCM frames to Vosk

#### Scenario: Audio is malformed or out of bounds
- **WHEN** an upload has an invalid RIFF/WAVE structure, chunk bounds or padding, encoding, channel count, sample rate, PCM16LE fields, declared data length, PCM-byte limit, duration, or HTTP payload size
- **THEN** the backend rejects it fail closed with a bounded diagnostic and without conversion, resampling, Vosk invocation, persistence, or raw-audio logging

### Requirement: Recording cancellation and diagnostics are bounded
The client SHALL expose only `MICROPHONE_DENIED`, `MICROPHONE_UNAVAILABLE`, `AUDIO_DURATION_EXCEEDED`, `AUDIO_SIZE_EXCEEDED`, `AUDIO_FORMAT_INVALID`, `AUDIO_UNSUPPORTED`, `MODEL_UNAVAILABLE`, `TRANSCRIPTION_EMPTY`, `TRANSCRIPTION_FAILED`, and `REQUEST_CANCELLED` diagnostics. It SHALL not expose paths, raw audio, Vosk exceptions, stack traces, or model internals. Cancellation during permission or recording SHALL stop and release media/audio resources and discard buffered audio; cancellation during processing SHALL abort the request and cause the backend to stop recognition and discard audio/transcript without publishing a result.

#### Scenario: User cancels active recording
- **WHEN** the user cancels while permission, recording, or processing is active
- **THEN** no final transcript, text-assistant request, preview, persistence mutation, or UML action is created

### Requirement: Voice does not create a UML mutator
The STT integration SHALL not decode assistant commands, resolve UML elements, invoke `UmlCommandBus`, mutate `ProjectDocument`, or bypass the existing text-assistant preview, confirmation, authorization, collaboration, and command execution behavior.

#### Scenario: Reviewed voice request reaches a destructive proposal
- **WHEN** a reviewed transcript produces a destructive text-assistant proposal
- **THEN** the existing preview and destructive confirmation requirements remain mandatory before any UML command can execute

#### Scenario: Transcription output is malformed or empty
- **WHEN** a transcription result is empty, malformed, cancelled, or unavailable
- **THEN** the system reports a bounded transcription diagnostic and leaves the current UML document unchanged
