## ADDED Requirements

### Requirement: Explicit browser collaboration transport lifecycle
The browser client SHALL interpret `NEXT_PUBLIC_REALTIME_URL` as the Socket.IO server base URL, initiate exactly one namespace connection for the active editor generation after its listeners are installed, and discard callbacks from disposed generations.

#### Scenario: Valid restored session connects to collaboration namespace
- **WHEN** an authenticated session and its loaded project are current in the editor
- **THEN** the client initiates one authenticated WebSocket transport to the `/collaboration` namespace and joins the project after connection

#### Scenario: StrictMode-like remount disposes an old generation
- **WHEN** an editor generation is cleaned up and replaced by a current generation
- **THEN** the old client is disconnected, its callbacks are ignored, and only the current generation can join or update lifecycle state

### Requirement: Browser collaboration handshake failure is terminally visible
The browser client SHALL transition an active collaboration editor out of `Connecting` on a connection handshake error and expose only a safe generic failure state without token, URL credential, or backend exception details.

#### Scenario: Transport handshake fails
- **WHEN** the Socket.IO client emits `connect_error` before a project join completes
- **THEN** the editor enters its safe error lifecycle and keeps shared mutations blocked
