## ADDED Requirements

### Requirement: Visible association-class materialization
The workspace SHALL render a materialized association class and its two replacement relationships solely from the resulting canonical project document. It SHALL not create, duplicate, or alter association semantics from React rendering, layout effects, save, reload, or synchronization callbacks.

#### Scenario: Display materialized result
- **WHEN** a user completes a many-to-many association in the editor
- **THEN** the canvas displays the association class and two relationships after the accepted canonical command

#### Scenario: Position the new class
- **WHEN** the endpoint nodes have usable logical positions
- **THEN** the new association class receives a reasonable initial position near their midpoint without changing semantic ownership

#### Scenario: Reload a materialized diagram
- **WHEN** a persisted materialized project is reopened
- **THEN** the editor displays the one persisted association class and its relationships without creating another class
