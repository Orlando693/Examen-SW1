## MODIFIED Requirements

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
