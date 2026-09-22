## Why

Archived CU-06 correctly delivered the deterministic `CanonicalUmlModel -> RelationalModel -> Spring Boot` engine, but an audit found no CASE editor action, project-scoped Nest endpoint, live-project input, or user artifact. This change closes that integration gap without replacing CU-06.

## What Changes

- Add authenticated, project-scoped orchestration from persisted `ProjectDocument.model` to the existing mapper and Spring generator.
- Materialize a temporary generated project, package it as a safe ZIP, stream it as a download, and clean it up.
- Add a visible editor action, persistence-aware state, download handling, diagnostics, and integration/manual evidence.

## Capabilities

### New Capabilities
- `live-project-spring-generation`: Generate a downloadable Spring backend from an authorized persisted CASE project.

### Modified Capabilities
- None.

## Impact

- Reuses `@examen-sw1/relational-core` and `@examen-sw1/spring-generator`; no fixture fallback exists in production.
- Does not modify archived CU-06, generator architecture, frontend generation, Flutter, XMI, voice, AI, or artifact history.
