## ADDED Requirements

### Requirement: Editor-required UML command extensions
The UML core SHALL expose minimal additional command-bus operations needed by the manual editor for UML elements already present in the canonical model but not fully covered by the initial command set.

#### Scenario: Create enumeration through command bus
- **WHEN** a supported command to create a UML enumeration is executed
- **THEN** an enumeration is added to the semantic UML model through the command route

#### Scenario: Rename enumeration through command bus
- **WHEN** a supported command to rename a UML enumeration is executed
- **THEN** the target enumeration name changes through the command route

#### Scenario: Manage enumeration literals through command bus
- **WHEN** supported commands add, update, or remove enumeration literals
- **THEN** enumeration literals change through the command route

#### Scenario: Delete enumeration through command bus
- **WHEN** a supported command deletes a UML enumeration
- **THEN** the enumeration and invalidated visual/layout references are removed through the command route

#### Scenario: Create generalization through command bus
- **WHEN** a supported command creates a UML generalization between classes
- **THEN** a generalization relationship is added to the semantic UML model through the command route

#### Scenario: Delete relationship through command bus
- **WHEN** a supported command deletes a UML relationship
- **THEN** the relationship is removed from the semantic UML model through the command route

#### Scenario: Apply batch layout through command bus
- **WHEN** a supported command applies positions for multiple diagram nodes
- **THEN** the command updates only `DiagramLayout` through the command route and preserves the semantic UML model

#### Scenario: Batch layout is one history entry
- **WHEN** a batch layout command is accepted through local history
- **THEN** one undo restores all previous node positions from that layout operation and one redo reapplies them

#### Scenario: Preserve validation and immutability contracts
- **WHEN** any editor-required command extension is accepted or rejected
- **THEN** it follows the existing command result, validation, document cloning, and non-mutating caller-owned document contracts
