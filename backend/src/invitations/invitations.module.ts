import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsRepository } from './invitations.repository.js';
import { InvitationsService } from './invitations.service.js';

@Module({ imports: [ProjectsModule], controllers: [InvitationsController], providers: [InvitationsRepository, InvitationsService] })
export class InvitationsModule {}
