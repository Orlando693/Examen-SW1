## Purpose

Provides local user identity and secure authenticated sessions so application APIs can reliably identify the user making a request.

## ADDED Requirements

### Requirement: Health remains publicly reachable
The system SHALL keep the existing `GET /health` contract public and SHALL not require a JWT Bearer token for that endpoint, including when bearer authentication is enforced globally.

#### Scenario: Read health without bearer token
- **WHEN** a client requests `GET /health` without an `Authorization` header
- **THEN** the system returns HTTP 200 according to the existing health contract

### Requirement: Local registration creates a secure user identity
The system SHALL register a user with a server-generated UUID `id`, normalized unique email, password hash, and server-managed creation/update timestamps from an email and password, and SHALL not accept a client-supplied user identifier.

#### Scenario: Register with valid credentials
- **WHEN** a client submits a valid email and bounded valid password to `POST /auth/register`
- **THEN** the system returns HTTP 201 with an access token and `{ id, email }` user representation without a password or password hash

#### Scenario: Reject duplicate email
- **WHEN** a client registers an email already used after normalization
- **THEN** the system returns HTTP 409 in the standard API error envelope without persistence internals

#### Scenario: Reject invalid registration input
- **WHEN** a registration request has an invalid email, invalid password, or unknown field
- **THEN** the system returns HTTP 400 in the standard API error envelope and creates no user

#### Scenario: Reject client-supplied user identifier
- **WHEN** a registration request includes an `id` field
- **THEN** the system rejects the request as invalid and generates no user identity from client-controlled ID data

### Requirement: Login verifies credentials without useful account enumeration
The system SHALL authenticate a registered user through `POST /auth/login` and return the same client-visible credential failure for an unknown email and an incorrect password.

#### Scenario: Login succeeds
- **WHEN** a client submits valid credentials for a registered user
- **THEN** the system returns HTTP 200 with an access token and `{ id, email }` user representation only

#### Scenario: Login credentials are invalid
- **WHEN** a client submits an unknown normalized email or an incorrect password
- **THEN** the system returns the same HTTP 401 `INVALID_CREDENTIALS` error envelope for both cases

### Requirement: JWT Bearer access identifies the current user
The system SHALL protect authenticated APIs with a JWT Bearer access token that expires after 60 minutes and expose the authenticated user's safe identity through `GET /auth/me`.

#### Scenario: Read current user
- **WHEN** a request to `GET /auth/me` includes a valid unexpired bearer token
- **THEN** the system returns HTTP 200 with only `{ id, email }`

#### Scenario: Reject missing or invalid bearer token
- **WHEN** a protected request has no bearer token, a malformed token, or an expired token
- **THEN** the system returns HTTP 401 `AUTHENTICATION_REQUIRED` in the standard API error envelope without JWT internals

### Requirement: Frontend maintains a bounded bearer session
The frontend SHALL keep the access token only in browser `sessionStorage`, attach it as `Authorization: Bearer <token>` to authenticated API requests, and remove it on logout or HTTP 401.

#### Scenario: Restore same-tab session
- **WHEN** a user reloads the application in the same browser tab before token expiry
- **THEN** the frontend restores the authenticated session from `sessionStorage` and validates it through the authenticated API contract

#### Scenario: Protect application routes
- **WHEN** an unauthenticated user visits the project management, editor, or invitation acceptance flow
- **THEN** the frontend redirects to `/login` while preserving only a validated internal return path

#### Scenario: Reject external return paths
- **WHEN** login or registration receives `https://attacker.example`, `//attacker.example`, or `javascript:alert(1)` as a return path
- **THEN** the frontend rejects it and never redirects outside the application origin

#### Scenario: Logout clears local session
- **WHEN** an authenticated user chooses logout
- **THEN** the frontend clears its token and user session state without calling a server logout endpoint
