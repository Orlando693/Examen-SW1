## ADDED Requirements

### Requirement: Shared JWT authentication across HTTP and realtime transports
The system SHALL use one authentication behavior to verify JWT signature, required subject, 60-minute expiration, and current user existence for both HTTP Bearer requests and Socket.IO connections.

#### Scenario: Authenticate a socket with auth payload
- **WHEN** a Socket.IO client supplies a valid access token through `auth.token`
- **THEN** the server resolves the safe current user from the verified subject without accepting client-supplied identity fields

#### Scenario: Keep tokens out of URLs
- **WHEN** a frontend establishes a realtime connection
- **THEN** it does not put the access token in a URL or query string and the server does not include it in logs, rooms, presence, acknowledgements, or errors

#### Scenario: Reject invalid realtime authentication
- **WHEN** a socket omits its token or supplies a malformed, expired, invalid-signature, or deleted-user token
- **THEN** the server rejects authentication as `AUTHENTICATION_REQUIRED` without JWT internals

### Requirement: Active socket authentication expiration
The system SHALL stop an active socket from sending or receiving protected project state after its access token expires, without introducing refresh tokens.

#### Scenario: Token expires while socket is connected
- **WHEN** the authenticated token reaches its expiration time
- **THEN** the server safely signals `auth:expired`, removes project membership and presence for that socket, and disconnects it

#### Scenario: Command arrives after expiration
- **WHEN** a socket submits a command at or after token expiration before disconnect cleanup completes
- **THEN** the server rejects it with action `REAUTHENTICATE`, persists nothing, and does not broadcast it

#### Scenario: Frontend handles realtime expiration
- **WHEN** the client receives realtime authentication expiration
- **THEN** it clears the invalid bounded auth session and requires login without attempting token refresh

### Requirement: Protected realtime emission revalidation
The system SHALL verify active socket expiration and current user identity immediately before protected project emissions as well as before queued command mutation.

#### Scenario: Expire while waiting in project queue
- **WHEN** a command waits for project serialization until its token expires
- **THEN** it persists nothing, advances no version, cleans socket presence, and cannot broadcast

#### Scenario: Expire before protected emission
- **WHEN** a recipient token expires before command, snapshot, metadata, or presence delivery
- **THEN** that recipient receives no protected payload and is removed from project collaboration state
