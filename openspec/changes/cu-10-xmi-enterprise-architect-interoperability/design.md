## Context

See `proposal.md` and the XMI interoperability delta specification. `CanonicalUmlModel` is the semantic source of truth, while `DiagramLayout` is visual-only. Existing persistence already owns authenticated project resources and the reusable UML validation engine; the command bus remains the only model-mutation route. CU-09 is active, so this design is planning only until its required closure.

## Goals / Non-Goals

**Goals:**
- Exchange a deliberately small, testable UML subset with EA using XMI 2.1.
- Export only the persisted canonical semantic document, and import only by constructing a complete candidate then atomically creating a new project.
- Make unsafe XML, unsupported required semantics, and semantic loss fail closed with bounded diagnostics.

**Non-Goals:**
- Diagram/layout interchange, EA-specific presentation data, arbitrary XMI/UML version support, schema downloading, full UML coverage, merging into an existing project, or changing relation support.
- Vision/Sharp/Florence-2, image-to-UML review UX, Flutter/Dart/Android, AWS, and generated-application changes. Those remain inactive or deferred.

## Decisions

### 1. One framework-independent XMI boundary, with persistence adapters at the edge

Create a pure XMI interchange module beside the canonical core. It receives a decoded persisted `ProjectDocument` for export and produces either structured diagnostics or a candidate semantic document for import. HTTP controllers only enforce authentication, request limits, ownership, and transactionally create the resulting project; the frontend only invokes the actions and displays results.

Import will construct the candidate through typed `UmlCommand` operations executed by `UmlCommandBus`, then run the same structural decoder and semantic validator used elsewhere. Direct object construction/persistence was rejected because import is an external mutation source and must not bypass the command route.

### 2. Narrow XMI 2.1 profile and explicit namespace contract

The writer emits an `xmi:XMI` root with `xmi:version="2.1"`, `xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"`, and `xmlns:uml="http://schema.omg.org/spec/UML/2.1"`; the semantic content is a UML model/package tree. The reader accepts this declared XMI/UML pair and EA's nonsemantic extension containers only. It does not claim generic XMI compatibility.

Canonical UUIDs map deterministically to XML-safe external IDs such as `id_<uuid-without-hyphens>`. The map is generated at the boundary and is never stored in `CanonicalUmlModel`. Import keeps a per-document external-ID lookup but assigns fresh canonical UUIDs while creating the new project. Reusing external IDs as canonical IDs was rejected because XMI IDs are untrusted, need not be UUIDs, and could collide.

Primitive references map only `String`, `Integer`, `Boolean`, `Real`, and `UnlimitedNatural`; classifier references resolve only to an imported supported class or enumeration. Associations carry owned ends and optional lower/upper values, with `none` aggregation for association, `shared` for aggregation, and `composite` for composition. Generalization maps separately and never carries association multiplicities. Unsupported types/kinds fail rather than degrade.

### 3. Parse defensively before adapting

The import HTTP boundary receives an XML body capped at 2 MiB. Before handing text to planned `fast-xml-parser`, it scans the raw UTF-8 text case-insensitively for `<!DOCTYPE` and `<!ENTITY` and rejects either declaration. Parser validation and strict adapter shape checks follow; no external schema/resource resolution exists.

The adapter walks only allow-listed XMI/UML structures. Unknown EA/vendor payload is ignored solely inside known nonsemantic extension/presentation containers (including `xmi:Extension`); unknown content influencing supported semantic identity, containment, classifier references, ends, aggregation, generalization, or multiplicity is rejected. Permissive generic-object parsing was rejected because it can silently discard semantic meaning.

### 4. Export/import endpoint and UI action plan

`GET /projects/:id/xmi` authorizes access, reloads the persisted resource, decodes and validates it, then streams a bounded attachment generated from its semantic model. The browser export action downloads it without client-side reconstruction.

`POST /projects/import/xmi` accepts one XML body and creates no resource until parse, adaptation, command-bus construction, structural decoding, semantic validation, and the database create transaction all succeed. The project name comes from the supported XMI model name after existing name validation, with a deterministic safe fallback. The UI first presents file/limit/new-project guidance, requires confirmation, then either surfaces bounded diagnostics or offers navigation to the returned project. It never replaces the active document.

### 5. Increment boundaries and EA evidence

Increment 1 delivers pure export, the authenticated download endpoint/action, fixtures, and a manual EA import-of-export gate. Increment 2 adds the safe import path, atomic new-project creation, UI action, round-trip fixtures, and a manual EA export-to-product plus round-trip gate. Automated fixtures prove the declared subset; actual EA evidence is mandatory but environment-dependent and recorded truthfully rather than simulated.

## Risks / Trade-offs

- [EA varies XMI shape by version/options] -> record version/options at both gates and accept only the declared profile or fail closed.
- [Strict parsing rejects otherwise useful EA files] -> preserve bounded diagnostics that identify unsupported required semantics; do not silently convert them.
- [2 MiB bounds complex models] -> state the fixed limit before upload; larger-file support requires a separate change.
- [Persisted model is invalid or stale] -> reload the resource, decode and validate before export; fail without producing a misleading document.
- [Import failures leave partial rows] -> defer project creation to a single transaction after candidate validation.

## Migration Plan

1. After CU-09 closes, add the pure export profile and fixtures, then the authorized download route/action and execute the Increment 1 EA gate.
2. Add the bounded parser/adaptor, fresh-ID command construction, validation, transactional project create, and import action; then run fixture and EA round-trip gates.
3. Rollback removes the XMI routes/actions and pure adapter package/module. No persisted schema migration, canonical model format change, layout conversion, or backfill is required.
