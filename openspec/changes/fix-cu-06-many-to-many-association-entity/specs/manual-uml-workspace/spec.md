## ADDED Requirements

### Requirement: Recursive relationship editing and self-loop projection
The workspace SHALL allow a modeler to create, inspect, edit, and delete a recursive association, including endpoint roles. It SHALL render a persisted recursive association as a self-loop solely from the canonical project document and SHALL not mutate relation semantics from React rendering, layout effects, reload, or synchronization callbacks.

#### Scenario: Create and display a self-loop
- **WHEN** a user creates `Empleado 0..* subordinados` to `Empleado 0..1 jefe`
- **THEN** the canvas displays one self-loop with both multiplicities and roles while the canonical document contains one recursive association

#### Scenario: Reload a recursive relationship
- **WHEN** a persisted project containing a self association is reopened
- **THEN** the editor displays the persisted self-loop once without creating a duplicate relationship or node

#### Scenario: Delete a self-loop
- **WHEN** a user deletes the selected recursive relationship
- **THEN** the canonical relationship and its projected self-loop are removed

### Requirement: Visible association-entity materialization
The workspace SHALL render normal and recursive materialized association entities and replacement relationships solely from the accepted canonical document.

#### Scenario: Display normal materialization
- **WHEN** a user creates `Alumno * <-> * Materia`
- **THEN** the canvas displays exactly one persisted `AlumnoMateria` class and its two replacement relationships

#### Scenario: Display recursive materialization
- **WHEN** a user creates the valid self many-to-many `Persona` relationship named `Amistad`
- **THEN** the canvas displays exactly one persisted `PersonaAmistad` class and two distinguishable relationships to `Persona`
