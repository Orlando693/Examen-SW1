## Purpose

Provides a local text assistant that converts user requests into reviewed, typed actions without granting the model authority to mutate data or UML directly.

## ADDED Requirements

### Requirement: Closed assistant command language
The system SHALL accept only structurally valid `AssistantCommand` values whose operation is one of `LIST`, `GET`, `SEARCH`, `CREATE`, `UPDATE`, `DELETE`, or `COUNT`, and whose target, fields, values, filters, and references use bounded typed data.

#### Scenario: Reject unknown or malformed assistant output
- **WHEN** a provider returns malformed data, an unknown operation, unknown fields, or fields outside the closed command schema
- **THEN** the system returns structured diagnostics and creates no executable action

#### Scenario: Normalize accepted intent independently of phrasing
- **WHEN** equivalent supported natural-language requests are interpreted successfully
- **THEN** the system exposes the same typed assistant command independent of the original wording

### Requirement: Declared-capability validation
The system SHALL validate a generated-application assistant command exclusively against the applicable Domain Manifest's declared entities, aliases, CRUD capabilities, fields, types, validations, relationships, and navigation before it can be reviewed or executed.

#### Scenario: Reject an undeclared generated-application capability
- **WHEN** a command refers to an entity, field, relationship, operation, or value incompatible with the Domain Manifest
- **THEN** validation rejects it with structured diagnostics and no backend request is made

#### Scenario: Resolve a declared entity alias
- **WHEN** a valid command uses a stable entity alias declared by the Domain Manifest
- **THEN** validation resolves it to that manifest entity without accepting arbitrary endpoint paths or URLs

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
The system SHALL execute approved actions using the same authenticated API and project-access rules as the corresponding manual operation and SHALL not expose credentials, tokens, SQL, shell execution, filesystem access, arbitrary URLs, or arbitrary tools to the provider.

#### Scenario: User lacks target permission
- **WHEN** an approved proposal reaches an operation that the current user is not authorized to perform
- **THEN** the operation is denied under the existing authorization contract and the assistant reports a safe failure
