import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';

@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, InvitationsModule],
  controllers: [HealthController],
})
export class AppModule {}
