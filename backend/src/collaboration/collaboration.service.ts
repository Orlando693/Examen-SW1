import { Inject, Injectable } from '@nestjs/common';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CollaborationSessionManager } from './collaboration-session.manager.js';
import { ProjectMutationCoordinator } from './project-mutation-coordinator.js';
import { PresenceRegistry } from './presence.registry.js';
import { createAuthoritativeResourceSnapshot, type CollaborationAccess, type CollaborationSnapshot, type PresenceInput } from './contracts.js';

@Injectable()
export class CollaborationService {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ProjectsRepository) private readonly repository: ProjectsRepository,
    @Inject(ProjectMutationCoordinator) private readonly coordinator: ProjectMutationCoordinator,
    @Inject(CollaborationSessionManager) private readonly sessions: CollaborationSessionManager,
    @Inject(PresenceRegistry) private readonly presence: PresenceRegistry,
  ) {}

  async join(projectId: string, socketId: string, user: SafeUser): Promise<CollaborationSnapshot> {
    return this.coordinator.run(projectId, async () => {
      const resource = await this.projects.get(user, projectId);
      const session = this.sessions.join(projectId, socketId);
      const accessLevel: CollaborationAccess = resource.project.ownerId === user.id ? 'OWNER' : 'EDITOR';
      this.presence.update(projectId, socketId, user.id, { cursor: null, selectionIds: [], editingElementId: null, activity: null });
      return { projectId, ...createAuthoritativeResourceSnapshot(resource), sessionId: session.sessionId, realtimeVersion: session.realtimeVersion, accessLevel, participants: await this.roster(projectId) };
    });
  }

  async resync(projectId: string, socketId: string, user: SafeUser): Promise<CollaborationSnapshot> {
    return this.join(projectId, socketId, user);
  }

  leave(projectId: string, socketId: string): void { this.presence.remove(projectId, socketId); this.sessions.leave(projectId, socketId); }

  async revalidate(projectId: string, user: SafeUser): Promise<void> { await this.projects.get(user, projectId); }

  async updatePresence(projectId: string, socketId: string, user: SafeUser, input: PresenceInput): Promise<Awaited<ReturnType<CollaborationService['roster']>>> {
    await this.revalidate(projectId, user);
    this.presence.update(projectId, socketId, user.id, input);
    return this.roster(projectId);
  }

  async roster(projectId: string) {
    const row = await this.repository.findParticipants(projectId);
    if (!row?.owner) return [];
    return this.presence.roster(projectId, [
      { userId: row.owner.id, email: row.owner.email, accessLevel: 'OWNER' as const },
      ...row.memberships.filter((membership) => membership.user.id !== row.owner?.id).map((membership) => ({ userId: membership.user.id, email: membership.user.email, accessLevel: 'EDITOR' as const })),
    ]);
  }
}
