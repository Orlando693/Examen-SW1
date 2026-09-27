## Purpose

Provides bounded XMI 2.1 exchange with Sparx Systems Enterprise Architect while preserving the canonical UML model as the only semantic authority.

## ADDED Requirements

### Requirement: Export persisted canonical UML as EA-readable XMI 2.1
The system SHALL let an authenticated authorized project member download XMI derived from the currently persisted `ProjectDocument` at `GET /projects/:id/xmi`. The response SHALL be an attachment with an XMI XML media type and SHALL be derived from the persisted canonical UML model, not the client document, React Flow state, or `DiagramLayout`.

The export SHALL declare `xmi:version="2.1"`, `xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"`, and `xmlns:uml="http://schema.omg.org/spec/UML/2.1"`. It SHALL emit only the supported semantic subset: UML packages when present, classes, enumerations and literals, attributes, associations, aggregation, composition, generalization, and applicable multiplicities. It SHALL not emit visual layout, diagram, presentation, or vendor-extension data.

#### Scenario: Authorized project export
- **WHEN** an authorized member exports an existing persisted project
- **THEN** the response downloads XMI 2.1 representing that persisted canonical semantic model and excludes layout data

#### Scenario: Unauthorized project export
- **WHEN** an unauthenticated or unauthorized requester exports a project
- **THEN** the system denies or conceals the project according to the existing project access policy and returns no XMI content

### Requirement: Preserve semantic identifiers and supported primitive types in XMI
The export SHALL map every canonical UUID used for exported UML elements to a unique XML `xmi:id` that is a valid XML identifier and use those mapped identifiers consistently for references. The mapping SHALL be deterministic for a given canonical UUID and SHALL remain external to the canonical model; an imported external `xmi:id` SHALL never replace a newly created canonical UUID.

The interchange subset SHALL map canonical primitive attribute types `String`, `Integer`, `Boolean`, `Real`, and `UnlimitedNatural` to the correspondingly named UML primitive type references. Other supported canonical attribute types SHALL be represented as references to exported classifier identifiers. An XMI document that requires an unsupported primitive or unresolved classifier reference SHALL be rejected on import rather than silently changed.

#### Scenario: Stable external identifier references
- **WHEN** a model with classes, attributes, and relationships is exported
- **THEN** each exported element has one deterministic `xmi:id` mapping and every XMI cross-reference resolves through that mapping

#### Scenario: Primitive and classifier type mapping
- **WHEN** an exported attribute uses a supported primitive or an exported classifier type
- **THEN** its XMI type reference preserves that type without introducing a new canonical semantic type

### Requirement: Exchange supported relationships without inventing semantics
The XMI interchange subset SHALL represent association endpoints and optional lower/upper multiplicities, aggregation and composition through UML association-end aggregation semantics, and generalization through UML generalization semantics. It SHALL preserve these relation kinds only because the canonical model supports `association`, `aggregation`, `composition`, and `generalization`.

The system SHALL reject an import whose relationship is malformed, has unresolved endpoints, has an unsupported relation kind, has an unsupported aggregation value, or has multiplicity invalid under the canonical validation engine. It SHALL not coerce unsupported relationship semantics into association, aggregation, composition, or generalization.

#### Scenario: Supported relationship exchange
- **WHEN** a model contains a supported association, aggregation, composition, or generalization
- **THEN** export and subsequent supported import preserve its relation kind, endpoints, and applicable multiplicities

#### Scenario: Unsupported relationship rejection
- **WHEN** an XMI import contains an unsupported or unresolved relationship semantic
- **THEN** the import fails with structured diagnostics and no project is created

### Requirement: Create a new project atomically from safe XMI input
The system SHALL accept an authenticated XMI upload of at most 2 MiB at `POST /projects/import/xmi` using an XML media type. Import SHALL parse and adapt the complete XMI into an intermediate representation, create a candidate canonical `ProjectDocument` with a new project identity and new canonical UUIDs, run structural and the existing reusable semantic validation, and persist a newly owned project only if every required stage succeeds.

The import action SHALL never overwrite, append to, or mutate an existing project. On malformed XML, unsupported required semantics, validation error, authorization failure, or persistence failure, it SHALL return bounded structured diagnostics and create no project. A successful response SHALL identify the newly created project for opening in the workspace.

#### Scenario: Successful import creates a separate project
- **WHEN** an authenticated user imports valid supported XMI
- **THEN** the system creates one new project owned by that user and leaves all existing projects unchanged

#### Scenario: Failed import is all-or-nothing
- **WHEN** parsing, adaptation, validation, or persistence of an XMI upload fails
- **THEN** no partial project or partial canonical model is persisted

### Requirement: Reject unsafe XML and handle EA extensions without semantic loss
The import boundary SHALL reject bodies larger than 2 MiB before XML parsing and SHALL explicitly reject any XML containing a `DOCTYPE` declaration or an entity declaration before parsing. It SHALL not retrieve external resources, expand custom entities, or process arbitrary XML features outside the declared XMI subset.

The system SHALL safely ignore unknown EA/vendor extension data only when it is explicitly nonsemantic extension or presentation metadata and cannot change the supported canonical UML meaning. It SHALL reject unknown vendor elements or attributes when they are required to determine an imported supported element's identity, type, containment, endpoint, multiplicity, aggregation, generalization, or other required semantic field.

#### Scenario: XML attack surface is rejected
- **WHEN** an upload exceeds 2 MiB or contains a DOCTYPE or entity declaration
- **THEN** the system rejects it before semantic adaptation and creates no project

#### Scenario: Nonsemantic EA extension is ignored
- **WHEN** supported XMI contains an unknown EA presentation or extension payload outside required semantic fields
- **THEN** import can continue without persisting that payload or treating it as canonical meaning

#### Scenario: Required vendor semantic is not silently dropped
- **WHEN** an EA/vendor extension is necessary to resolve required supported UML semantics
- **THEN** import rejects the document with a bounded unsupported-semantic diagnostic

### Requirement: Provide export and import action plans without layout interoperability
The project/editor interface SHALL expose an export action for an open authorized project and an import action that selects one XMI file, explains the 2 MiB limit and new-project behavior, submits only after explicit user action, and presents either the downloaded export, created project, or bounded diagnostics. Import success SHALL navigate or offer navigation to the new project; failure SHALL leave the current project and editor state unchanged.

Layout exchange, EA diagram geometry, rendering, selection, and vendor presentation metadata are explicit non-goals and SHALL not be represented as successful interoperability.

#### Scenario: User imports through the UI
- **WHEN** a user selects a valid XMI file and confirms import
- **THEN** the UI reports the created separate project and does not replace the currently open project

#### Scenario: Import failure preserves active workspace
- **WHEN** the import action returns an error
- **THEN** the UI displays bounded diagnostics and preserves the active project's document and workspace state

### Requirement: Validate EA interoperability in two manual gates
The delivery SHALL include a manual EA export gate after the export increment and a manual EA import/round-trip gate after the import increment. Each gate SHALL record the EA version, selected XMI 2.1 option, fixture/project used, observed supported semantics, result, and blockers; no unmeasured EA compatibility claim SHALL be made.

#### Scenario: Export gate evidence
- **WHEN** Increment 1 is ready for manual acceptance
- **THEN** EA is used to open a product-exported XMI 2.1 file and the recorded evidence states whether supported semantics were observed

#### Scenario: Import and round-trip gate evidence
- **WHEN** Increment 2 is ready for manual acceptance
- **THEN** an EA-exported XMI 2.1 file is imported into a new project and a supported export/import round-trip is recorded with its result or exact blocker
