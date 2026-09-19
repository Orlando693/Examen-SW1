# local-text-assistant Specification

## Purpose

Provides a local text assistant that converts user requests into reviewed, typed actions without granting the model authority to mutate data or UML directly.

## Requirements

### Requirement: Closed assistant command language
The system SHALL accept only structurally valid UML-focused `AssistantCommand` values whose operation, target, fields, values, and references use bounded typed data. The local model grammar and prompt MUST NOT offer an ID for an entity created by `create_class`, `add_attribute`, or `create_relation`. If a structurally valid candidate outside that grammar includes such a create identity, the system MUST NOT propagate it to the UML creation command; the trusted UML creation route SHALL allocate that identity. Commands that target existing classes, attributes, or relationships SHALL continue to accept canonical IDs or names as their bounded typed references.

#### Scenario: Reject unknown or malformed assistant output
- **WHEN** a provider returns malformed data, an unknown operation, unknown fields, or fields outside the closed command schema
- **THEN** the system returns structured diagnostics and creates no executable action

#### Scenario: Normalize accepted intent independently of phrasing
- **WHEN** equivalent supported natural-language requests are interpreted successfully
- **THEN** the system exposes the same typed assistant command independent of the original wording

#### Scenario: Allocate identity for a created UML entity
- **WHEN** an approved valid create command, including a candidate that carries a colliding creation identity outside the model grammar, is applied through the established UML command route
- **THEN** the trusted route creates exactly one new entity with a unique identity and does not use or duplicate the candidate's identity

#### Scenario: Preserve references to existing UML entities
- **WHEN** an `add_attribute`, `create_relation`, `UPDATE`, or `DELETE` command identifies an existing target by canonical ID
- **THEN** the system resolves that ID against the current canonical model and preserves the existing unresolved-reference and ambiguity behavior

### Requirement: Generated-application CRUD exclusion
The system SHALL integrate the assistant only with the CASE/UML editor in CU-08 and SHALL NOT interpret or execute CRUD operations against generated-application instances. `DomainManifest` SHALL remain read-only and SHALL NOT supply endpoint selection or an execution adapter.

#### Scenario: Generated-application CRUD is requested
- **WHEN** an input requires application-data commands, OpenAPI operation resolution, or authenticated API execution
- **THEN** CU-08 does not create an executable action and leaves the capability for a separately designed change

### Requirement: CASE editor interpretation boundary
The system SHALL obtain local-model interpretations through an authenticated backend adapter that is read-only with respect to UML. The browser SHALL NOT import the local LLM runtime or model binary. For normal CASE assistant interpretation requests, the browser SHALL send text and cancellation capability without a generation-timeout value; the production HTTP DTO SHALL not define `timeoutMs` and its reject-extra-fields policy SHALL reject an HTTP `timeoutMs`. The backend controller and service SHALL not source a timeout override; the backend adapter SHALL own the normal generation deadline. The adapter SHALL return only status, streaming presentation text, decoded candidates, clarification, or diagnostics; it SHALL NOT execute UML commands.

#### Scenario: Normal CASE assistant request
- **WHEN** a user submits a normal assistant request from the CASE editor
- **THEN** the frontend does not impose a generation timeout and the authenticated backend applies its normal local-provider deadline

#### Scenario: HTTP caller supplies a timeout override
- **WHEN** an authenticated caller submits `timeoutMs` to either assistant interpretation HTTP endpoint
- **THEN** DTO validation rejects the request and neither the controller nor service supplies a provider timeout override

#### Scenario: User cancels a CASE assistant request
- **WHEN** a user cancels an in-flight CASE assistant request
- **THEN** the frontend aborts the request and the backend/provider treats it as cancellation without executing a UML command

#### Scenario: Apply an approved CASE editor preview
- **WHEN** a user explicitly approves a valid UML preview in the CASE editor
- **THEN** the editor submits its existing typed `UmlCommand` values through `executeAndSync()` and the established collaboration and `UmlCommandBus` route

### Requirement: UML command adaptation
The system SHALL convert a validated UML-targeted assistant command only into supported typed `UmlCommand` values and SHALL apply it only through the existing `UmlCommandBus` route.

#### Scenario: Apply a valid UML proposal
- **WHEN** a user approves a validated assistant proposal that maps to a supported UML command
- **THEN** the command bus executes it with its normal semantic validation and result behavior

#### Scenario: Reject unsupported UML intent
- **WHEN** a request cannot map to a supported typed UML command or would violate canonical validation
- **THEN** the system reports structured diagnostics and leaves the ProjectDocument unchanged

### Requirement: Review-controlled execution
The system SHALL present a human-readable preview and structured action summary for every valid assistant command and SHALL require explicit user approval before execution; destructive operations SHALL require an explicit destructive confirmation.

#### Scenario: Cancel a preview
- **WHEN** a user cancels a pending assistant preview
- **THEN** the system discards the proposal without executing it

#### Scenario: Confirm a delete
- **WHEN** a validated `DELETE` proposal is presented
- **THEN** the system requires destructive confirmation before any execution adapter is invoked

### Requirement: Authorization-preserving execution
The system SHALL execute approved UML actions using the same project-access rules as the corresponding manual operation and SHALL not expose credentials, tokens, SQL, shell execution, filesystem access, arbitrary URLs, or arbitrary tools to the provider.

#### Scenario: User lacks target permission
- **WHEN** an approved UML proposal reaches an operation that the current user is not authorized to perform
- **THEN** the operation is denied under the existing authorization contract and the assistant reports a safe failure
