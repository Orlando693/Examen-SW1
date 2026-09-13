import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { CollaborationGateway } from './collaboration.gateway.js';
import { CollaborationService } from './collaboration.service.js';
import { CollaborationSessionManager } from './collaboration-session.manager.js';
import { PresenceRegistry } from './presence.registry.js';
import { PresenceRateLimiter } from './presence-rate-limiter.js';
import { ProjectMutationCoordinator } from './project-mutation-coordinator.js';
import { ProjectCommandCoordinator } from './project-command-coordinator.js';

@Module({ imports: [AuthModule, ProjectsModule], providers: [CollaborationGateway, CollaborationService, CollaborationSessionManager, PresenceRegistry, PresenceRateLimiter, ProjectMutationCoordinator, ProjectCommandCoordinator] })
export class CollaborationModule {}
