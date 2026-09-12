# project-invitations Specification

## Purpose

Provides secure owner-managed project invitations that bind a limited collaborator role to an intended email address and expire after seven days.

## Requirements

### Requirement: Owners create controlled editor invitations
The system SHALL allow only a project owner to create an invitation for a normalized email address, initial `EDITOR` role, and seven-day expiration.

#### Scenario: Create invitation
- **WHEN** an owner submits a valid email to `POST /projects/:projectId/invitations`
- **THEN** the system creates a pending invitation and returns HTTP 201 with safe invitation metadata and a one-time acceptance URL

#### Scenario: Non-owner cannot invite
- **WHEN** an editor attempts to create an invitation for a project they can edit
- **THEN** the system returns HTTP 403 `FORBIDDEN` and creates no invitation

### Requirement: Invitation tokens are secret, single-use, and expiring
The system SHALL generate an acceptance token from at least 32 cryptographically random bytes encoded as base64url, persist only its unique SHA-256 hash, never log it, and never return the raw token after creation.

#### Scenario: Token expires
- **WHEN** a pending invitation is inspected, accepted, or rejected after its seven-day expiration
- **THEN** the system rejects the operation with the controlled expired-invitation error and grants no membership

#### Scenario: Accepted token cannot replay
- **WHEN** a previously accepted invitation token is submitted again
- **THEN** the system returns a controlled already-consumed error and creates no additional membership

### Requirement: Invitation state transitions retain exact audit timestamps
The system SHALL persist `createdAt`, `expiresAt`, and nullable `acceptedAt`, `rejectedAt`, and `revokedAt` for every invitation without adding an `updatedAt` field.

#### Scenario: Accept records only acceptance timestamp
- **WHEN** a pending unexpired invitation is accepted
- **THEN** it becomes `ACCEPTED` with `acceptedAt` set to the transition time and `rejectedAt` and `revokedAt` remaining null

#### Scenario: Reject records only rejection timestamp
- **WHEN** a pending unexpired invitation is rejected by the matching invitee
- **THEN** it becomes `REJECTED` with `rejectedAt` set to the transition time and `acceptedAt` and `revokedAt` remaining null

#### Scenario: Revoke records only revocation timestamp
- **WHEN** an owner revokes a pending invitation
- **THEN** it becomes `REVOKED` with `revokedAt` set to the transition time and `acceptedAt` and `rejectedAt` remaining null

### Requirement: Invitation acceptance is bound to the intended account
The system SHALL require the authenticated user's normalized email to exactly match the invitation email before that user can inspect, accept, or reject a pending invitation.

#### Scenario: Matching invitee accepts
- **WHEN** the intended authenticated invitee submits a valid pending token to `POST /invitations/accept`
- **THEN** the system atomically creates or preserves one `EDITOR` membership and marks the invitation accepted

#### Scenario: Mismatched account is rejected
- **WHEN** an authenticated account with a different email submits a valid invitation token
- **THEN** the system returns HTTP 403 `INVITATION_EMAIL_MISMATCH` and does not disclose project content or create membership

#### Scenario: Invitee rejects invitation
- **WHEN** the intended authenticated invitee submits a valid unexpired pending token to `POST /invitations/reject`
- **THEN** the system marks the invitation rejected and the token cannot grant membership

### Requirement: Owners can inspect and revoke pending invitations
The system SHALL allow a project owner to list project invitations and revoke a pending invitation, while excluding those operations from editors.

#### Scenario: Owner lists invitations
- **WHEN** an owner requests `GET /projects/:projectId/invitations`
- **THEN** the system returns safe invitation metadata without raw tokens or token hashes

#### Scenario: Owner revokes pending invitation
- **WHEN** an owner requests revocation of a pending project invitation
- **THEN** the system marks it revoked and subsequent token operations cannot grant membership

#### Scenario: Editor cannot administer invitations
- **WHEN** an editor lists or revokes invitations for a member project
- **THEN** the system returns HTTP 403 `FORBIDDEN`

### Requirement: Invitation frontend avoids token URL exposure
The frontend SHALL use `/invitations/accept#token=<raw-token>` for manually shared acceptance links and shall remove the fragment after reading it before login, registration, inspection, acceptance, or rejection continues.

#### Scenario: Unauthenticated invitee continues after login
- **WHEN** an unauthenticated invitee opens a valid acceptance link
- **THEN** the frontend preserves the token only in current-tab transient session state, removes it from the address bar, and resumes the invitation flow after login or registration

#### Scenario: Terminal outcome clears transient token
- **WHEN** accept or reject succeeds, or an expired, revoked, or already-used response makes continuation terminal
- **THEN** the frontend clears the raw token from the URL, component state, and session continuation state without logging it

#### Scenario: Inspection returns minimal data
- **WHEN** the intended authenticated invitee submits a valid token to `POST /invitations/inspect`
- **THEN** the response contains only minimal invitation state needed for acceptance and never a full project resource
