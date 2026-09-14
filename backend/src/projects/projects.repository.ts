import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(data: Prisma.ProjectUncheckedCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  findAccessibleById(id: string, userId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, ...this.accessWhere(userId) } });
  }

  findOwnedById(id: string, userId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, ownerId: userId } });
  }

  listAccessible(userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({ where: this.accessWhere(userId), orderBy: { updatedAt: 'desc' } });
  }

  findParticipants(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      select: {
        owner: { select: { id: true, email: true } },
        memberships: { where: { role: 'EDITOR' }, select: { user: { select: { id: true, email: true } } } },
      },
    });
  }

  async updateIfAccessibleVersion(id: string, userId: string, storageVersion: number, data: Prisma.ProjectUpdateManyMutationInput): Promise<boolean> {
    const result = await this.prisma.project.updateMany({ where: { AND: [{ id, storageVersion }, this.accessWhere(userId)] }, data: { ...data, storageVersion: { increment: 1 } } });
    return result.count === 1;
  }

  async updateAndReturnIfAccessibleVersion(id: string, userId: string, storageVersion: number, data: Prisma.ProjectUpdateManyMutationInput): Promise<Project | null> {
    const rows = await this.prisma.project.updateManyAndReturn({
      where: { AND: [{ id, storageVersion }, this.accessWhere(userId)] },
      data: { ...data, storageVersion: { increment: 1 } },
    });
    return rows[0] ?? null;
  }

  async updateIfOwnerVersion(id: string, userId: string, storageVersion: number, data: Prisma.ProjectUpdateManyMutationInput): Promise<boolean> {
    const result = await this.prisma.project.updateMany({ where: { id, ownerId: userId, storageVersion }, data: { ...data, storageVersion: { increment: 1 } } });
    return result.count === 1;
  }

  async updateAndReturnIfOwnerVersion(id: string, userId: string, storageVersion: number, data: Prisma.ProjectUpdateManyMutationInput): Promise<Project | null> {
    const rows = await this.prisma.project.updateManyAndReturn({
      where: { id, ownerId: userId, storageVersion },
      data: { ...data, storageVersion: { increment: 1 } },
    });
    return rows[0] ?? null;
  }

  async deleteIfOwnerVersion(id: string, userId: string, storageVersion: number): Promise<boolean> {
    const result = await this.prisma.project.deleteMany({ where: { id, ownerId: userId, storageVersion } });
    return result.count === 1;
  }

  private accessWhere(userId: string): Prisma.ProjectWhereInput {
    return { OR: [{ ownerId: userId }, { memberships: { some: { userId, role: 'EDITOR' } } }] };
  }
}
