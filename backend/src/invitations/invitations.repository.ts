import { Inject, Injectable } from '@nestjs/common';
import { ProjectInvitationStatus, type Prisma, type ProjectInvitation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InvitationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(data: Prisma.ProjectInvitationUncheckedCreateInput): Promise<ProjectInvitation> {
    return this.prisma.projectInvitation.create({ data });
  }

  listForProject(projectId: string): Promise<ProjectInvitation[]> {
    return this.prisma.projectInvitation.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  async revokePending(projectId: string, invitationId: string, now: Date): Promise<boolean> {
    const result = await this.prisma.projectInvitation.updateMany({ where: { id: invitationId, projectId, status: ProjectInvitationStatus.PENDING }, data: { status: ProjectInvitationStatus.REVOKED, revokedAt: now } });
    return result.count === 1;
  }

  findByHash(tokenHash: string): Promise<ProjectInvitation | null> {
    return this.prisma.projectInvitation.findUnique({ where: { tokenHash } });
  }

  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation);
  }
}
