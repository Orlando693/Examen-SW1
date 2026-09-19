## Context

See `proposal.md` for motivation. `AssistantCommand` currently makes `classId`, `attributeId`, and `relationId` optional inputs to the three create operations. The strict decoder, canonical JSON schema, local grammar projection, resolved command, and UML adapter preserve those values. The UML command executor already allocates IDs when create commands omit them.

`ElementReference` is separate: it denotes an existing class, attribute, or relationship by canonical ID or name. Resolution, clarification, pre-apply revalidation, and the command bus rely on this distinction.

## Goals / Non-Goals

**Goals:**

- Make model output incapable of selecting identities for newly created UML entities.
- Keep trusted allocation in the established `UmlCommandBus` creation path.
- Preserve ID-based targeting for existing entities and the current preview, authorization, revalidation, and apply boundaries.
- Verify creation succeeds once with a colliding model-owned ID attempt and cover attribute and relationship creation.

**Non-Goals:**

- No change to `CanonicalUmlModel`, validation rules, ID-generation implementation, realtime command normalization, collaboration protocol, persistence, backend HTTP DTOs, provider selection, or UI.
- No Qwen/GGUF smoke, benchmark, dependency, migration, archive, commit, or push work.

## Decisions

### Remove create identities at the untrusted command boundary

The canonical JSON schema used for local grammar projection will omit `classId`, `attributeId`, and `relationId`. The projected local grammar will therefore prohibit these fields and the prompt will state the same semantic rule as defense in depth. For a full candidate that still carries one of the currently structurally valid optional fields, the trusted adapter will discard it before producing a UML create command; the decoder remains authoritative for malformed and unknown fields.

Alternative considered: reject legacy candidates with a create ID in the decoder. Rejected because a malformed/bypassing provider candidate with a colliding identity must still prove that the persisted creation is uniquely allocated, rather than turn that regression into a no-op. The grammar and prompt prevent normal generation; the adapter boundary prevents identity authority.

### Delegate allocation by omitting UML create IDs

Resolved create commands and their UML-command adaptation will omit explicit creation IDs. The existing trusted executor will allocate unique IDs during preflight and final execution. Existing target references remain `ElementReference` and continue to resolve against the context and document.

Alternative considered: allocate IDs in assistant-core during preview. Rejected because preview must remain side-effect-free and identity generation belongs to the normal UML mutation route, not the model or its adapter.

### Test the boundary and the complete candidate path

Assistant-core tests will prove that schemas/grammar no longer expose create-ID fields, the prompt prohibits them, and existing ID references remain valid. A complete assistant candidate carrying a colliding create identity will pass through the existing candidate path but its identity will be discarded before the bus; applying it persists exactly one new uniquely identified entity without a duplicate. Attribute and relation creation tests will prove their created identities are also trusted while their class endpoint references remain accepted.

Alternative considered: test only adapted `UmlCommand` objects. Rejected because it would not cover decoder, schema/grammar, provider candidate, preview, and persistence behavior together.

## Risks / Trade-offs

- [Typed fixtures or internal callers may still construct create commands with these fields] -> Update affected fixtures at compile time and retain strict runtime rejection for untyped provider output.
- [The preflight and final bus execution each allocate ephemeral IDs] -> Assertions will verify the persisted/final result has one new unique entity, not require preview allocation or a particular generated value.
- [Prompt wording alone cannot secure model output] -> Treat it as guidance only; enforce the boundary in the schema and decoder.

## Migration Plan

1. Deploy as an internal assistant-command contract tightening; no persisted assistant commands or public HTTP payloads are stored or accepted for replay.
2. Roll back by reverting the implementation change if an internal caller unexpectedly depends on create IDs; no data migration is required.
