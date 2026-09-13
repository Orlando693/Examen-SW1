## ADDED Requirements

### Requirement: Existing project roles govern realtime collaboration
The system SHALL permit only the project owner and active `EDITOR` members to join, resynchronize, publish presence, receive protected room events, and submit realtime UML commands.

#### Scenario: Owner and editor collaborate
- **WHEN** a project owner and accepted editor establish valid realtime sessions for the same project
- **THEN** both can join the same project room, exchange authorized presence, and submit supported UML commands

#### Scenario: Pending invitation grants no realtime access
- **WHEN** an authenticated user has a pending invitation but no accepted membership
- **THEN** join is concealed as `PROJECT_NOT_FOUND` and no project or presence information is disclosed

#### Scenario: Ownerless project grants no realtime access
- **WHEN** a project has a null owner reference
- **THEN** realtime join is concealed until an explicit operator backfill establishes valid ownership

### Requirement: Revalidate access throughout a collaboration session
The system SHALL revalidate current user existence and project access before each command and before every protected project emission.

#### Scenario: Editor loses access before a command
- **WHEN** an editor membership no longer exists when that socket submits a command
- **THEN** the command is rejected without persistence, the socket leaves the room, its presence is removed, and future project broadcasts are withheld

#### Scenario: Passive participant loses access
- **WHEN** a joined participant loses project access without submitting a command
- **THEN** recipient revalidation removes the socket and presence before another sensitive project event is delivered

#### Scenario: User is deleted during a session
- **WHEN** the authenticated user can no longer be resolved
- **THEN** project access ends, presence is cleared, and no further protected realtime state is sent

### Requirement: Realtime concealment and room isolation
The system SHALL preserve the existing unrelated-project concealment policy across join, command, resync, presence, access loss, project switching, and broadcast behavior.

#### Scenario: Submit a command for another project
- **WHEN** a socket joined to one project submits a command or presence update naming another project
- **THEN** the server rejects it without joining, mutating, or disclosing the other project

#### Scenario: Broadcast to one authorized room
- **WHEN** a project command, snapshot replacement, or presence change is emitted
- **THEN** no socket outside the currently authorized project room receives it
