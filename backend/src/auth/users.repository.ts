import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SafeUser {
  id: string;
  email: string;
}

export interface UserWithPassword extends SafeUser {
  passwordHash: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  async findSafeById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  }

  async create(email: string, passwordHash: string): Promise<SafeUser> {
    return this.prisma.user.create({ data: { email: normalizeEmail(email), passwordHash }, select: { id: true, email: true } });
  }
}
