import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { CollaborationModule } from './collaboration/collaboration.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { VoiceModule } from './voice/voice.module.js';
import { SpringGenerationModule } from './generations/spring-generation.module.js';

@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, InvitationsModule, CollaborationModule, AssistantModule, VoiceModule, SpringGenerationModule],
  controllers: [HealthController],
})
export class AppModule {}
