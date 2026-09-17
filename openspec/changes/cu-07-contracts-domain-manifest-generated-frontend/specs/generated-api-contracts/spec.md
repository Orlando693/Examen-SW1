## Purpose

Defines executable API contracts for generated Spring applications and portable Postman verification derived from the API authority.

## ADDED Requirements

### Requirement: Generated OpenAPI is extracted from executable backend
The system SHALL obtain an OpenAPI document from a running generated Spring backend for a known valid model. The extracted document SHALL describe the generated CRUD, relationship-navigation, pagination, sorting, filtering, search, DTO, validation, and stable error behavior exposed by that backend.

#### Scenario: Executable backend exposes its contract
- **WHEN** the known generated backend is started successfully
- **THEN** the contract extraction returns its OpenAPI document and validates the declared endpoints, request and response schemas, error responses, and query parameters against the running backend

#### Scenario: Contract cannot be extracted
- **WHEN** the generated backend does not start or does not expose a valid OpenAPI document
- **THEN** extraction fails with bounded diagnostic evidence and no contract-derived artifact is reported as verified

### Requirement: Postman Collection is derived from OpenAPI
The system SHALL generate a deterministic Postman Collection only from an extracted OpenAPI document. The collection SHALL represent the supported generated API operations and SHALL not be maintained as an independent route definition.

#### Scenario: Equivalent contracts yield equal collections
- **WHEN** semantically equivalent extracted OpenAPI documents are processed twice
- **THEN** the generated Postman Collection has identical ordered content and no machine-specific values

#### Scenario: Generated collection verifies the backend
- **WHEN** the generated Postman Collection runs against the known generated backend
- **THEN** its requests use the OpenAPI-derived paths, methods, parameters, and schemas and report the actual contract result

### Requirement: Contract derivation fails closed
The system SHALL reject an OpenAPI document that is invalid, ambiguous for supported generated operations, or inconsistent with the executable generated backend. It SHALL not substitute guessed routes, DTOs, query controls, or error contracts.

#### Scenario: Missing required operation is rejected
- **WHEN** an expected generated entity operation is absent or incompatible in the extracted document
- **THEN** contract validation reports the entity and operation as a structured failure and blocks Postman derivation
