import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  list(): Promise<Project[]> {
    return this.prisma.project.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async updateIfVersion(id: string, storageVersion: number, data: Prisma.ProjectUpdateManyMutationInput): Promise<boolean> {
    const result = await this.prisma.project.updateMany({ where: { id, storageVersion }, data: { ...data, storageVersion: { increment: 1 } } });
    return result.count === 1;
  }

  async deleteIfVersion(id: string, storageVersion: number): Promise<boolean> {
    const result = await this.prisma.project.deleteMany({ where: { id, storageVersion } });
    return result.count === 1;
  }
}
