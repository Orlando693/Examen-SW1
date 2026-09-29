## ADDED Requirements

### Requirement: Generated recursive and association-entity persistence
The generated backend SHALL render recursive one-to-many and materialized normal/self many-to-many models as normal generated entities, repositories, services, controllers, validation contracts, and supported CRUD resources. It SHALL use ordinary JPA FK mappings and SHALL not render `@ManyToMany` or `@JoinTable` for those semantics.

#### Scenario: Generate recursive one-to-many
- **WHEN** the relational model contains `Empleado` with a `jefe_id` self FK
- **THEN** generated `Empleado` source contains a valid self `@ManyToOne` and role-distinguished navigation without a join table

#### Scenario: Generate normal association entity
- **WHEN** the relational model contains `Alumno`, `Materia`, and `AlumnoMateria` with two foreign keys
- **THEN** the generated project contains ordinary entity and CRUD layers for all three classes and no direct many-to-many annotation

#### Scenario: Generate recursive association entity
- **WHEN** the relational model contains `Persona` and `PersonaAmistad` with `persona_origen_id` and `persona_destino_id`
- **THEN** generated `PersonaAmistad` source contains two `@ManyToOne` mappings to `Persona` with distinct `@JoinColumn` names and ordinary CRUD layers

### Requirement: Generated ZIP acceptance evidence
The generation flow SHALL produce a ZIP that reflects only the persisted migrated canonical model and that passes generated-project verification. Acceptance SHALL use an isolated PostgreSQL database and the generated API contract for recursive one-to-many, normal many-to-many association entities, and recursive many-to-many association entities.

#### Scenario: Verify generated ZIP and API
- **WHEN** the three accepted model scenarios are generated from persisted projects
- **THEN** extracted Java 21 projects pass Gradle test and build, Swagger is available, Postman CRUD creates, reads, updates when supported, and deletes the required resources, and PostgreSQL inspection confirms the expected tables and foreign keys
