## Purpose

Defines ephemeral authorized collaborator roster and canvas awareness with online/offline, derived avatar, activity, cursor, selection, and editing presentation while keeping durable UML data unchanged.

## ADDED Requirements

### Requirement: Authorized participant roster
The system SHALL expose a roster only for the project owner and accepted EDITOR memberships, deriving safe identity, access level, initials/avatar presentation from normalized email, online state, and nullable server-derived `lastActivityAt` without persistence.

#### Scenario: Show authorized online and offline participants
- **WHEN** owner and accepted editor are project participants and only one has active sockets
- **THEN** both appear once in the roster with server-derived role/avatar data and accurate online state

#### Scenario: Exclude non-participants
- **WHEN** an invitation is pending, rejected, revoked, or belongs to an unrelated user
- **THEN** that identity is absent from roster and presence payloads

#### Scenario: Restart loses unknown activity safely
- **WHEN** the backend restarts before activity was observed for an authorized participant
- **THEN** roster presentation retains safe participant identity but reports nullable unknown last activity without restoring persisted presence

### Requirement: User-level online presence across sockets
The system SHALL deduplicate online presence by user ID while tracking all joined socket IDs and their full ephemeral states.

#### Scenario: Open and close multiple tabs
- **WHEN** the same user joins from two sockets then one disconnects
- **THEN** one participant remains online until the final socket disconnects

#### Scenario: Final socket becomes offline
- **WHEN** the final socket leaves, expires, is revoked, or disconnects
- **THEN** the participant remains authorized in roster as offline and its aggregate cursor, selection, and editing state are cleared

### Requirement: Full socket presence snapshots and deterministic aggregation
The system SHALL accept only a full bounded socket snapshot `{ cursor, selectionIds, editingElementId, activity }`, server-stamp activity time, and aggregate each user from its most recently active connected socket.

#### Scenario: Aggregate multiple tabs deterministically
- **WHEN** two tabs for one user publish distinct valid full snapshots
- **THEN** the roster exposes one user whose ephemeral state is from the latest server-stamped active socket

#### Scenario: Recompute after active tab disconnects
- **WHEN** the socket providing a user's aggregate state disconnects while another remains
- **THEN** the aggregate recomputes from the remaining most-recent socket without leaving stale fields

#### Scenario: Reject forged or partial presence
- **WHEN** a payload includes user identity, role, timestamp, unknown fields, or omits required full-snapshot fields
- **THEN** the server rejects or clears it without publishing forged or ambiguous state

### Requirement: Flow-space cursor presence
The system SHALL transmit finite bounded React Flow diagram coordinates obtained from `screenToFlowPosition` or an equivalent flow-coordinate conversion, never raw browser screen coordinates.

#### Scenario: Render across independent viewports
- **WHEN** a joined user moves a pointer over the flow pane and publishes cursor presence
- **THEN** recipients render that cursor through viewport-aware projection without moving their own viewport

#### Scenario: Clear cursor outside the pane
- **WHEN** the pointer leaves the flow pane, tab becomes hidden, active socket leaves, or socket disconnects
- **THEN** cursor is immediately cleared and pending trailing cursor work cannot recreate it

### Requirement: Bounded selection, editing, and activity presence
The system SHALL allow only bounded canonical element IDs for selection/editing and a closed activity enum, while keeping remote presentation separate from local selection and canonical UML state.

#### Scenario: Show remote selection and editing
- **WHEN** a collaborator publishes valid selected IDs, edited element, and activity
- **THEN** recipients render presentation-only indicators without replacing their own selection or mutating `ProjectDocument` or `UmlHistory`

#### Scenario: Reject invalid presence references
- **WHEN** selected or edited IDs do not exist in the active project, exceed bounds, or activity is not allow-listed
- **THEN** the server rejects or clears unsafe fields without persistence or version advancement

### Requirement: Presence update limits and cleanup
The client SHALL coalesce cursor updates to at most 20 Hz, send selection/editing/activity changes immediately after cancelling obsolete trailing work, and the server SHALL limit each socket to at most 30 presence updates per second with bounded burst/state.

#### Scenario: Throttle and clear safely
- **WHEN** high-frequency pointer events occur then leave, switch, unmount, or disconnect occurs
- **THEN** no trailing event recreates cleared presence and memory/timers remain bounded

#### Scenario: Presence does not change project versions
- **WHEN** valid presence is published, aggregated, cleared, or throttled
- **THEN** canonical revision, storage version, realtime version, and document schema version remain unchanged
