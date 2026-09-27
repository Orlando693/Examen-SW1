## ADDED Requirements

### Requirement: Generated association-entity persistence and CRUD
The generated backend SHALL render each materialized association class as a normal generated entity, repository, service, controller, validation contract, and supported CRUD resource. Its persistence mapping SHALL use the generated association entity's own identifier plus normal JPA relationships to the endpoint entities and SHALL not render direct `@ManyToMany` or `@JoinTable` for that semantic relationship.

#### Scenario: Generate an association entity
- **WHEN** the relational model contains `Alumno`, `Materia`, and `AlumnoMateria` with two foreign keys
- **THEN** the generated project contains an `AlumnoMateria` entity and its ordinary generated CRUD layers with JPA mappings to `Alumno` and `Materia`

#### Scenario: Build generated association project
- **WHEN** the known association-entity fixture is generated with Java 21 available
- **THEN** the generated Gradle Wrapper test and build complete successfully and generated source contains no direct many-to-many annotation for the fixture

#### Scenario: Generate a migrated historical project
- **WHEN** a historical direct many-to-many project has been migrated through the authoritative project flow
- **THEN** its generated source contains the association entity and contains neither `@ManyToMany` nor `@JoinTable`
