# project-access-control Specification

## Purpose

Defines ownership and editor membership rules that limit persisted UML project access to authenticated users with explicit authorization.

## Requirements

### Requirement: Projects have server-controlled owners
The system SHALL assign each newly created project to the authenticated creator and SHALL not accept a client-controlled owner identifier.

#### Scenario: Create owned project
- **WHEN** an authenticated user submits a valid `POST /projects` request
- **THEN** the system creates the project with that user's identifier as owner and preserves the existing project resource contract

#### Scenario: Reject owner spoofing
- **WHEN** a project-create request includes an owner identifier or attempts to select another owner
- **THEN** the system rejects the request as invalid and does not create a project for the supplied owner

### Requirement: Authorized users receive only accessible projects
The system SHALL require authentication for all project lifecycle endpoints and list only projects owned by or actively assigned to the current user.

#### Scenario: List owned and editor projects
- **WHEN** an authenticated owner or accepted editor requests `GET /projects`
- **THEN** the response contains only projects the requester owns or has an active editor membership for

#### Scenario: List each accessible project once
- **WHEN** an authenticated user has overlapping owner and membership access due to controlled legacy or corrupt fixture data
- **THEN** `GET /projects` returns that project at most once by project identifier

#### Scenario: Conceal unrelated project
- **WHEN** an authenticated user requests a project resource or document save for a project they neither own nor belong to
- **THEN** the system returns `PROJECT_NOT_FOUND` and does not disclose the project's existence or storage version

### Requirement: Owner and editor permissions are distinct
The system SHALL allow owners to administer their projects and allow `EDITOR` members only to list, read, open, edit UML content, and save documents.

#### Scenario: Editor saves authorized UML changes
- **WHEN** an accepted editor saves a valid UML document for their member project using the current storage version
- **THEN** the system persists the document under the existing project resource and CAS contract

#### Scenario: Editor cannot administer project metadata
- **WHEN** an accepted editor attempts to rename or delete their member project
- **THEN** the system returns HTTP 403 `FORBIDDEN` and leaves the project unchanged

#### Scenario: Owner administers project metadata
- **WHEN** the owner submits a valid rename or delete request with the current storage version
- **THEN** the system performs the existing metadata or hard-delete lifecycle behavior

### Requirement: Membership access is explicit and non-duplicative
The system SHALL represent an accepted collaborator through exactly one membership containing `projectId`, `userId`, initial `EDITOR` role, and server-managed `createdAt`, while representing the owner exclusively through the project owner reference.

#### Scenario: Membership grants project access
- **WHEN** an invitation is accepted for an eligible user
- **THEN** exactly one `EDITOR` membership grants that user the editor permissions for the invitation's project

#### Scenario: Owner is not duplicated as member
- **WHEN** project access records are inspected for an owner-created project
- **THEN** the owner is represented by the project owner reference and not by a duplicate membership row

### Requirement: Legacy ownerless projects are not implicitly claimed
The system SHALL keep existing projects with no owner inaccessible through authenticated project APIs until an explicit operator backfill assigns an intended owner.

#### Scenario: Ownerless legacy project is not listed
- **WHEN** an authenticated user lists projects before an operator assigns a legacy ownerless project
- **THEN** that ownerless project is absent from the response

#### Scenario: No automatic legacy claim
- **WHEN** a user registers or logs in while legacy ownerless projects exist
- **THEN** the system does not assign any such project to that user

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
