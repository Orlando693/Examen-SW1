import { Inject, Injectable } from '@nestjs/common';
import { ProjectInvitationStatus, type ProjectInvitation } from '@prisma/client';
import type { SafeUser } from '../auth/users.repository.js';
import { normalizeEmail } from '../auth/users.repository.js';
import { ProjectApiError } from '../projects/project.errors.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { createInvitationToken, hashInvitationToken, invitationExpiry } from './invitation-tokens.js';
import { InvitationsRepository } from './invitations.repository.js';

export interface InvitationView {
  id: string; invitedEmail: string; role: 'EDITOR'; status: ProjectInvitationStatus; createdAt: string; expiresAt: string;
  acceptedAt: string | null; rejectedAt: string | null; revokedAt: string | null;
}

@Injectable()
export class InvitationsService {
  constructor(@Inject(InvitationsRepository) private readonly invitations: InvitationsRepository, @Inject(ProjectsRepository) private readonly projects: ProjectsRepository) {}

  async create(user: SafeUser, projectId: string, email: string): Promise<{ invitation: InvitationView; acceptanceUrl: string }> {
    await this.requireOwner(user.id, projectId);
    const token = createInvitationToken();
    const invitation = await this.invitations.create({ projectId, inviterId: user.id, invitedEmail: normalizeEmail(email), tokenHash: hashInvitationToken(token), expiresAt: invitationExpiry() });
    return { invitation: this.view(invitation), acceptanceUrl: `/invitations/accept#token=${encodeURIComponent(token)}` };
  }

  async list(user: SafeUser, projectId: string): Promise<{ items: InvitationView[] }> {
    await this.requireOwner(user.id, projectId);
    return { items: (await this.invitations.listForProject(projectId)).map((invitation) => this.view(invitation)) };
  }

  async revoke(user: SafeUser, projectId: string, invitationId: string): Promise<void> {
    await this.requireOwner(user.id, projectId);
    if (!await this.invitations.revokePending(projectId, invitationId, new Date())) throw new ProjectApiError(404, 'INVITATION_INVALID', 'The invitation was not found or is no longer pending.');
  }

  async inspect(user: SafeUser, token: string): Promise<{ invitation: Pick<InvitationView, 'status' | 'expiresAt' | 'role'> }> {
    const invitation = await this.requireUsable(user, token);
    return { invitation: { status: invitation.status, expiresAt: invitation.expiresAt.toISOString(), role: 'EDITOR' } };
  }

  accept(user: SafeUser, token: string): Promise<void> { return this.consume(user, token, 'ACCEPTED'); }
  reject(user: SafeUser, token: string): Promise<void> { return this.consume(user, token, 'REJECTED'); }

  private async consume(user: SafeUser, token: string, status: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    const tokenHash = hashInvitationToken(token);
    await this.invitations.transaction(async (tx) => {
      const invitation = await tx.projectInvitation.findUnique({ where: { tokenHash } });
      this.assertUsable(invitation, user);
      if (!await tx.project.findUnique({ where: { id: invitation.projectId }, select: { id: true } })) {
        throw new ProjectApiError(404, 'INVITATION_INVALID', 'The invitation is invalid.');
      }
      const now = new Date();
      const changed = await tx.projectInvitation.updateMany({ where: { id: invitation.id, status: ProjectInvitationStatus.PENDING, expiresAt: { gt: now } }, data: status === 'ACCEPTED' ? { status, acceptedAt: now } : { status, rejectedAt: now } });
      if (changed.count !== 1) throw new ProjectApiError(409, 'INVITATION_ALREADY_CONSUMED', 'The invitation has already been consumed.');
      if (status === 'ACCEPTED') await tx.projectMembership.upsert({ where: { projectId_userId: { projectId: invitation.projectId, userId: user.id } }, create: { projectId: invitation.projectId, userId: user.id, role: 'EDITOR' }, update: {} });
    });
  }

  private async requireUsable(user: SafeUser, token: string): Promise<ProjectInvitation> {
    const invitation = await this.invitations.findByHash(hashInvitationToken(token));
    this.assertUsable(invitation, user);
    return invitation;
  }

  private assertUsable(invitation: ProjectInvitation | null, user: SafeUser): asserts invitation is ProjectInvitation {
    if (!invitation) throw new ProjectApiError(404, 'INVITATION_INVALID', 'The invitation is invalid.');
    if (invitation.invitedEmail !== normalizeEmail(user.email)) throw new ProjectApiError(403, 'INVITATION_EMAIL_MISMATCH', 'This invitation is for a different email address.');
    if (invitation.status === ProjectInvitationStatus.REVOKED) throw new ProjectApiError(409, 'INVITATION_REVOKED', 'The invitation was revoked.');
    if (invitation.status !== ProjectInvitationStatus.PENDING) throw new ProjectApiError(409, 'INVITATION_ALREADY_CONSUMED', 'The invitation has already been consumed.');
    if (invitation.expiresAt <= new Date()) throw new ProjectApiError(410, 'INVITATION_EXPIRED', 'The invitation has expired.');
  }

  private async requireOwner(userId: string, projectId: string): Promise<void> {
    if (await this.projects.findOwnedById(projectId, userId)) return;
    if (await this.projects.findAccessibleById(projectId, userId)) throw new ProjectApiError(403, 'FORBIDDEN', 'Only the project owner can administer invitations.');
    throw new ProjectApiError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
  }

  private view(invitation: ProjectInvitation): InvitationView {
    return { id: invitation.id, invitedEmail: invitation.invitedEmail, role: 'EDITOR', status: invitation.status, createdAt: invitation.createdAt.toISOString(), expiresAt: invitation.expiresAt.toISOString(), acceptedAt: invitation.acceptedAt?.toISOString() ?? null, rejectedAt: invitation.rejectedAt?.toISOString() ?? null, revokedAt: invitation.revokedAt?.toISOString() ?? null };
  }
}
