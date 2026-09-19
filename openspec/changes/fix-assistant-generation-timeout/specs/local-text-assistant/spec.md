## MODIFIED Requirements

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
