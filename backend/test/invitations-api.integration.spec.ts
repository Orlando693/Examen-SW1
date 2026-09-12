import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.config.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { hashInvitationToken } from '../src/invitations/invitation-tokens.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  describe.skip('PostgreSQL invitations API', () => { it('requires TEST_DATABASE_URL', () => {}); });
} else {
  describe('PostgreSQL invitations API', () => {
    const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    const projects = new Set<string>();
    const emails = new Set<string>();
    let app: NestFastifyApplication;
    const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
    beforeAll(async () => { await prisma.$connect(); });
    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); configureApplication(app); await app.init(); await app.getHttpAdapter().getInstance().ready();
    });
    afterEach(async () => { await app.close(); await prisma.project.deleteMany({ where: { id: { in: [...projects] } } }); await prisma.user.deleteMany({ where: { email: { in: [...emails] } } }); projects.clear(); emails.clear(); });
    afterAll(async () => { await prisma.$disconnect(); });
    async function user(email = `invite-${randomUUID()}@example.com`) { emails.add(email); const response = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters' }).expect(201); return { id: response.body.user.id as string, email, token: response.body.accessToken as string }; }
    async function project(token: string) { const response = await request(app.getHttpServer()).post('/projects').set(bearer(token)).send({ name: 'Invited project' }).expect(201); projects.add(response.body.project.id); return response.body.project.id as string; }
    async function createInvitation(ownerToken: string, projectId: string, email: string) { return request(app.getHttpServer()).post(`/projects/${projectId}/invitations`).set(bearer(ownerToken)).send({ email }).expect(201); }

    it('creates safe owner invitations, lists them, and revokes only pending invitations', async () => {
      const owner = await user(); const recipient = await user(); const projectId = await project(owner.token);
      const created = await createInvitation(owner.token, projectId, ` ${recipient.email.toUpperCase()} `);
      expect(created.body.acceptanceUrl).toMatch(/^\/invitations\/accept#token=/);
      expect(created.body.invitation).toMatchObject({ invitedEmail: recipient.email, role: 'EDITOR', status: 'PENDING' });
      expect(JSON.stringify(created.body.invitation)).not.toContain('tokenHash');
      const rawToken = new URLSearchParams(created.body.acceptanceUrl.split('#')[1]).get('token')!;
       const persisted = await prisma.projectInvitation.findUniqueOrThrow({ where: { id: created.body.invitation.id } });
       expect(persisted.tokenHash).toBe(hashInvitationToken(rawToken)); expect(JSON.stringify(persisted)).not.toContain(rawToken);
       expect(persisted.inviterId).toBe(owner.id);
      await request(app.getHttpServer()).get(`/projects/${projectId}/invitations`).set(bearer(owner.token)).expect(200).expect(({ body }) => expect(body.items).toHaveLength(1));
      await request(app.getHttpServer()).post(`/projects/${projectId}/invitations/${created.body.invitation.id}/revoke`).set(bearer(owner.token)).expect(204);
      const revoked = await prisma.projectInvitation.findUniqueOrThrow({ where: { id: created.body.invitation.id } });
      expect(revoked).toMatchObject({ status: 'REVOKED', acceptedAt: null, rejectedAt: null, revokedAt: expect.any(Date) });
      await request(app.getHttpServer()).post('/invitations/inspect').set(bearer(recipient.token)).send({ token: rawToken }).expect(409).expect(({ body }) => expect(body.error.code).toBe('INVITATION_REVOKED'));
    });

    it('conceals unrelated projects and denies editors invitation administration', async () => {
      const owner = await user(); const editor = await user(); const unrelated = await user(); const projectId = await project(owner.token);
      await prisma.projectMembership.create({ data: { projectId, userId: editor.id } });
      await request(app.getHttpServer()).post(`/projects/${projectId}/invitations`).set(bearer(editor.token)).send({ email: unrelated.email }).expect(403);
      await request(app.getHttpServer()).get(`/projects/${projectId}/invitations`).set(bearer(editor.token)).expect(403);
      await request(app.getHttpServer()).get(`/projects/${projectId}/invitations`).set(bearer(unrelated.token)).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
    });

    it('binds acceptance to email, creates one membership, and rejects replay or expiry', async () => {
      const owner = await user(); const recipient = await user(); const wrong = await user(); const projectId = await project(owner.token);
      const created = await createInvitation(owner.token, projectId, recipient.email); const token = new URLSearchParams(created.body.acceptanceUrl.split('#')[1]).get('token')!;
      await request(app.getHttpServer()).post('/invitations/inspect').set(bearer(wrong.token)).send({ token }).expect(403).expect(({ body }) => expect(body.error.code).toBe('INVITATION_EMAIL_MISMATCH'));
      await request(app.getHttpServer()).post('/invitations/accept').set(bearer(recipient.token)).send({ token }).expect(204);
      expect(await prisma.projectMembership.count({ where: { projectId, userId: recipient.id } })).toBe(1);
      const accepted = await prisma.projectInvitation.findUniqueOrThrow({ where: { id: created.body.invitation.id } });
      expect(accepted).toMatchObject({ status: 'ACCEPTED', acceptedAt: expect.any(Date), rejectedAt: null, revokedAt: null });
      await request(app.getHttpServer()).get(`/projects/${projectId}`).set(bearer(recipient.token)).expect(200);
      await request(app.getHttpServer()).post('/invitations/accept').set(bearer(recipient.token)).send({ token }).expect(409).expect(({ body }) => expect(body.error.code).toBe('INVITATION_ALREADY_CONSUMED'));
      const expiry = await createInvitation(owner.token, projectId, wrong.email); const expiredToken = new URLSearchParams(expiry.body.acceptanceUrl.split('#')[1]).get('token')!;
      await prisma.projectInvitation.update({ where: { id: expiry.body.invitation.id }, data: { expiresAt: new Date(Date.now() - 1) } });
      await request(app.getHttpServer()).post('/invitations/accept').set(bearer(wrong.token)).send({ token: expiredToken }).expect(410).expect(({ body }) => expect(body.error.code).toBe('INVITATION_EXPIRED'));
    });

    it('allows exactly one concurrent terminal transition and cascades invitations on project deletion', async () => {
      const owner = await user(); const recipient = await user(); const projectId = await project(owner.token);
      const created = await createInvitation(owner.token, projectId, recipient.email); const token = new URLSearchParams(created.body.acceptanceUrl.split('#')[1]).get('token')!;
      const responses = await Promise.all([request(app.getHttpServer()).post('/invitations/accept').set(bearer(recipient.token)).send({ token }), request(app.getHttpServer()).post('/invitations/reject').set(bearer(recipient.token)).send({ token })]);
      expect(responses.map((response) => response.status).sort()).toEqual([204, 409]);
      const invitation = await prisma.projectInvitation.findUniqueOrThrow({ where: { id: created.body.invitation.id } });
      expect(Number(invitation.acceptedAt !== null) + Number(invitation.rejectedAt !== null) + Number(invitation.revokedAt !== null)).toBe(1);
      await prisma.project.delete({ where: { id: projectId } }); projects.delete(projectId);
      expect(await prisma.projectInvitation.count({ where: { id: created.body.invitation.id } })).toBe(0);
    });
  });
}
