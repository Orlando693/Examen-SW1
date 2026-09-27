## ADDED Requirements

### Requirement: Authoritative atomic materialization command
The collaboration boundary SHALL normalize, deduplicate, execute, persist, and broadcast many-to-many materialization as one authoritative UML command result containing all authority-selected IDs and deterministic names. It SHALL not permit client rendering or retries to create additional association classes.

#### Scenario: Concurrent retry is deduplicated
- **WHEN** an applied materialization command is retried with the same realtime command identity and canonical intent
- **THEN** the server returns the original result without another persistence write, broadcast, association class, or relationship pair

#### Scenario: Participants converge on materialization
- **WHEN** an authorized materialization command is applied
- **THEN** each participant installs the same canonical class, relationships, layout, revision, and digest through the existing authoritative command path

#### Scenario: Join a migrated historical project
- **WHEN** a realtime join targets a historical project requiring direct many-to-many migration
- **THEN** the server durably migrates it before creating or returning the authoritative session snapshot and all joined clients receive only the version-2 association-class document
