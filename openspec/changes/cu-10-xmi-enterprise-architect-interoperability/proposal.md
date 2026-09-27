## Why

The persisted canonical `ProjectDocument` cannot yet exchange its supported UML subset with Sparx Systems Enterprise Architect (EA). CU-10 must provide a bounded, secure XMI 2.1 path so external UML can enter through validation and a persisted project can be exported without making canvas layout or vendor metadata authoritative.

## What Changes

- Add XMI 2.1 export from an authorized, persisted `ProjectDocument`, deriving semantic content exclusively from its canonical UML model.
- Add bounded XMI 2.1 import that creates a new project only after parsing, adapting, and validating the complete document successfully.
- Define an EA-interoperable subset: classes, enumerations, primitive-typed attributes, associations with optional multiplicities, aggregation, composition, and generalization.
- Add authenticated export/import endpoints and UI action plans, with explicit failure states and no modification of an existing project during import.
- Add an explicit XML safety boundary using `fast-xml-parser`, a 2 MiB upload limit, and rejection of DTD/DOCTYPE/entity declarations.
- Require an EA manual acceptance gate after export and after import/round-trip.
- Defer vision/image-to-UML and Flutter work. They are not planned, implemented, or accepted by this change.

## Capabilities

### New Capabilities
- `xmi-enterprise-architect-interoperability`: Secure XMI 2.1 export and all-or-nothing import of the supported canonical UML subset with Enterprise Architect compatibility.

### Modified Capabilities
- None.

## Impact

- Planned affected areas are `uml-core` XMI adapter contracts, NestJS project import/export routes and authorization, persisted-project services, frontend project/editor actions, fixture-based tests, and CU-10 documentation.
- `fast-xml-parser` is the planned XML parser dependency; no XML schema validator, remote schema retrieval, XSLT, image/VLM, Flutter, or generated-application behavior is introduced.
- Execution remains blocked until CU-09 is closed according to the mandatory CU ordering. Planning this isolated change does not activate a second implementation CU.
