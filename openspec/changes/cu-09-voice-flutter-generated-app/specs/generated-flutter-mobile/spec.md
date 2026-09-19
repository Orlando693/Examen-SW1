## Purpose

Defines deterministic generation of an independent Flutter mobile client from the verified generated Spring API contract and Domain Manifest, with Android as its minimum demonstrable target.

## ADDED Requirements

### Requirement: Flutter generation consumes existing generated contracts
The system SHALL generate an independent Flutter and Dart application only after independently validated generated Spring OpenAPI and Domain Manifest inputs pass a fail-closed cross-contract check. OpenAPI SHALL be the sole authority for operation IDs, HTTP methods, paths, parameters, media types, request/response schemas, and transport statuses. Domain Manifest SHALL be the sole authority for entity aliases, field/control semantics, declared CRUD capabilities, and relationship navigation. The generator SHALL reject missing, duplicate, or incompatible entity/capability/operation mappings and SHALL not guess a route, request body, field, or relationship. It SHALL not read Canonical UML, reconstruct relational rules, import the generated Next.js application, or use Capacitor.

#### Scenario: Generated mobile client calls a declared operation
- **WHEN** a user performs a supported generated-entity action
- **THEN** the Flutter client uses only the matching contract-derived REST operation and declared request/response mapping

### Requirement: Generated Flutter app provides minimal declared CRUD
The generated Flutter application SHALL provide a mobile-usable entity selector, list, detail, create, edit, and delete flows for declared CRUD capabilities, plus loading, empty, operational-error, and contract-incompatibility states. It SHALL expose relationship navigation only when declared by the generated contracts.

#### Scenario: Contract input is incompatible
- **WHEN** the generator detects a missing, invalid, or incompatible OpenAPI or Domain Manifest capability
- **THEN** it fails generation with structured diagnostics and the generated application does not guess a network route

#### Scenario: Mobile user opens a declared entity
- **WHEN** an entity declares list and read capabilities in the supplied contracts
- **THEN** the generated application can show its list and detail using the contract-derived transport mapping

### Requirement: Flutter output is deterministic and safely materialized
The system SHALL generate byte-equivalent relative paths, contents, and SHA-256 manifest entries for equivalent contract inputs and generation options. It SHALL write only below an explicit output root and reject unsafe or colliding paths.

#### Scenario: Regenerate equivalent mobile inputs
- **WHEN** equivalent validated OpenAPI and Domain Manifest inputs are materialized twice in separate output roots
- **THEN** both outputs have identical relative files, content hashes, and generation manifests

### Requirement: Generated Flutter scope remains separate
The Flutter generator SHALL consume existing validated contracts without modifying Spring routes or OpenAPI production, Domain Manifest v1, relational mapping, generated Next.js frontend behavior, or CASE assistant/voice behavior. The generated application's API base URL SHALL be an explicit runtime configuration value and SHALL not be inferred from a CASE setting or undeclared route.

#### Scenario: Contract authority is insufficient
- **WHEN** a required transport or UI semantic is absent from its designated contract authority
- **THEN** generation fails with a structured diagnostic and does not materialize a partial mobile client

### Requirement: Android build evidence is explicit and opt-in
The generated Flutter project SHALL declare Android as its minimum build target and provide an explicit verification path that reports executable paths and actual versions from `flutter --version`, `dart --version`, `flutter doctor -v`, `java -version`, and the generated `android/gradlew[.bat] --version`. On Windows it SHALL validate absolute existing `FLUTTER_ROOT`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` values plus `FLUTTER_ROOT\\bin\\flutter.bat`, `ANDROID_SDK_ROOT\\platform-tools\\adb.exe`, `JAVA_HOME\\bin\\java.exe`, and `android\\gradlew.bat`. It SHALL validate the JDK version required by the generated Gradle wrapper/Android Gradle Plugin compatibility record. Only after this and an explicit request may it run from the generated project root `flutter pub get`, `flutter analyze`, `flutter test`, and `flutter build apk --debug`. Normal root automated checks SHALL not require Flutter, Android SDKs, emulators, generated-project dependency downloads, or connected devices.

#### Scenario: Android prerequisite is unavailable
- **WHEN** the explicit generated-project Android verification is requested without a compatible Flutter or Android toolchain
- **THEN** it reports the missing prerequisite clearly and does not claim a successful Android build

### Requirement: Android and CU manual acceptance are explicit
The system SHALL require an Increment 3 manual gate that uses the generated Android application against the generated Spring API for declared CRUD and relationship navigation, reviews the Android build evidence, and records blockers. Final CU acceptance SHALL review all three increment gates; it SHALL not archive, commit, push, or begin CU-10 without explicit user acceptance.

#### Scenario: Android evidence is incomplete
- **WHEN** the Android build command, generated app interaction, or required environment prerequisite was not completed
- **THEN** the CU record distinguishes successful build, prerequisite failure, blocked manual acceptance, and not-run states without claiming final acceptance
