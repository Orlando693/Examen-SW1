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

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const payloadLimit = 1_048_576;

function assertIsolatedTestDatabase(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'postgresql:' || url.hostname !== 'localhost' || url.port !== '5432' || url.pathname !== '/examen_sw1_test') {
    throw new Error('TEST_DATABASE_URL must target the isolated local integration database.');
  }
}

function documentPayload(name: string) {
  return { revision: 1, model: { packages: [], classes: [{ id: `class-${name}`, name, attributes: [], operations: [] }], enumerations: [], relationships: [] }, layout: { nodes: [] } };
}

if (!testDatabaseUrl) {
  describe.skip('PostgreSQL project access API', () => { it('requires TEST_DATABASE_URL', () => {}); });
} else {
  describe('PostgreSQL project access API', () => {
    assertIsolatedTestDatabase(testDatabaseUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    const projectIds = new Set<string>();
    const emails = new Set<string>();
    let app: NestFastifyApplication;

    beforeAll(async () => { await prisma.$connect(); });
    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ bodyLimit: payloadLimit }));
      configureApplication(app);
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });
    afterEach(async () => {
      await app.close();
      await prisma.project.deleteMany({ where: { id: { in: [...projectIds] } } });
      await prisma.user.deleteMany({ where: { email: { in: [...emails] } } });
      projectIds.clear();
      emails.clear();
    });
    afterAll(async () => { await prisma.$disconnect(); });

    async function user() {
      const email = `project-${randomUUID()}@example.com`;
      emails.add(email);
      const response = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters' }).expect(201);
      return { id: response.body.user.id as string, token: response.body.accessToken as string };
    }

    function authenticated(token: string) {
      return { Authorization: `Bearer ${token}` };
    }

    async function project(token: string, name = 'Project') {
      const response = await request(app.getHttpServer()).post('/projects').set(authenticated(token)).send({ name }).expect(201);
      projectIds.add(response.body.project.id);
      return response.body;
    }

    it('requires authentication, assigns the authenticated owner, and rejects owner spoofing', async () => {
      const owner = await user();
      await request(app.getHttpServer()).get('/projects').expect(401);
      await request(app.getHttpServer()).post('/projects').send({ name: 'Unauthenticated' }).expect(401);
      await request(app.getHttpServer()).post('/projects').set(authenticated(owner.token)).send({ name: 'Spoof', ownerId: randomUUID() }).expect(400);
      const created = await project(owner.token, 'Owned');
      const stored = await prisma.project.findUniqueOrThrow({ where: { id: created.project.id } });
      expect(stored.ownerId).toBe(owner.id);
      expect(await prisma.projectMembership.count({ where: { projectId: stored.id } })).toBe(0);
    });

    it('preserves the authenticated owner project lifecycle resource and JSONB round-trip', async () => {
      const owner = await user();
      const created = await project(owner.token, 'Project API');
      expect(created).toMatchObject({ storageVersion: 0, documentSchemaVersion: 1, project: { metadata: { name: 'Project API' }, revision: 0 } });
      expect(Object.keys(created).sort()).toEqual(['documentSchemaVersion', 'project', 'storageVersion']);

      const listed = await request(app.getHttpServer()).get('/projects').set(authenticated(owner.token)).expect(200);
      const summary = listed.body.items.find((item: { id: string }) => item.id === created.project.id);
      expect(summary).toMatchObject({ id: created.project.id, name: 'Project API', description: null, storageVersion: 0, access: 'OWNER' });
      expect(Object.keys(summary).sort()).toEqual(['access', 'createdAt', 'description', 'id', 'name', 'storageVersion', 'updatedAt']);

      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).set(authenticated(owner.token)).expect(200).expect(created);
      const saved = await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(owner.token)).send({ baseStorageVersion: 0, document: documentPayload('person') }).expect(200);
      expect(saved.body.storageVersion).toBe(1);
      expect(saved.body.project.revision).toBe(1);
      expect(saved.body.project.model.classes).toEqual([expect.objectContaining({ id: 'class-person', name: 'person' })]);

      const patched = await request(app.getHttpServer()).patch(`/projects/${created.project.id}`).set(authenticated(owner.token)).send({ baseStorageVersion: 1, description: null, name: 'Renamed' }).expect(200);
      expect(patched.body).toMatchObject({ storageVersion: 2, project: { metadata: { name: 'Renamed' } } });
      expect(patched.body.project.metadata.description).toBeUndefined();
      await request(app.getHttpServer()).delete(`/projects/${created.project.id}?baseStorageVersion=2`).set(authenticated(owner.token)).expect(204);
      projectIds.delete(created.project.id);
      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).set(authenticated(owner.token)).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
    });

    it('retains owner request validation and payload-limit error filtering', async () => {
      const owner = await user();
      await request(app.getHttpServer()).post('/projects').set(authenticated(owner.token)).send({ name: 'Allowed', ownerId: randomUUID() }).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).get('/projects/not-a-uuid').set(authenticated(owner.token)).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      const created = await project(owner.token, 'Validation');
      await request(app.getHttpServer()).patch(`/projects/${created.project.id}`).set(authenticated(owner.token)).send({ baseStorageVersion: 0 }).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).delete(`/projects/${created.project.id}?baseStorageVersion=-1`).set(authenticated(owner.token)).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(owner.token)).send({ baseStorageVersion: 0.5, document: {} }).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).post('/projects').set(authenticated(owner.token)).send({ name: 'x'.repeat(payloadLimit) }).expect(413).expect(({ body }) => expect(body.error.code).toBe('PAYLOAD_TOO_LARGE'));
    });

    it('retains semantic validation and safe corrupt persisted JSONB responses for owners', async () => {
      const owner = await user();
      const created = await project(owner.token, 'Validation cases');
      const warningSave = await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(owner.token)).send({ baseStorageVersion: 0, document: documentPayload('lowercase') }).expect(200);
      expect(warningSave.body.storageVersion).toBe(1);
      await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(owner.token)).send({ baseStorageVersion: 1, document: { revision: 2, model: { packages: [], classes: [{ id: 'class-invalid', name: '', attributes: [], operations: [] }], enumerations: [], relationships: [] }, layout: { nodes: [] } } }).expect(422).expect(({ body }) => expect(body.error.code).toBe('DOCUMENT_VALIDATION_FAILED'));
      await prisma.project.update({ where: { id: created.project.id }, data: { model: { corrupt: true } } });
      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).set(authenticated(owner.token)).expect(500).expect(({ body }) => expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: {} }));

      const semanticCorruption = await project(owner.token, 'Semantic corruption');
      await prisma.project.update({ where: { id: semanticCorruption.project.id }, data: { model: { packages: [], classes: [{ id: 'class-invalid', name: '', attributes: [], operations: [] }], enumerations: [], relationships: [] } } });
      await request(app.getHttpServer()).get(`/projects/${semanticCorruption.project.id}`).set(authenticated(owner.token)).expect(500).expect(({ body }) => expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: {} }));

      const unsupported = await project(owner.token, 'Unsupported format');
      await prisma.project.update({ where: { id: unsupported.project.id }, data: { documentSchemaVersion: 2 } });
      await request(app.getHttpServer()).get(`/projects/${unsupported.project.id}`).set(authenticated(owner.token)).expect(422).expect(({ body }) => expect(body.error.code).toBe('UNSUPPORTED_DOCUMENT_SCHEMA_VERSION'));
    });

    it('scopes list/read/save to owner or editor, reports access safely, and lists overlap once', async () => {
      const owner = await user();
      const editor = await user();
      const unrelated = await user();
      const created = await project(owner.token, 'Shared');
      await prisma.projectMembership.create({ data: { projectId: created.project.id, userId: editor.id } });
      await prisma.projectMembership.create({ data: { projectId: created.project.id, userId: owner.id } });

      const ownerList = await request(app.getHttpServer()).get('/projects').set(authenticated(owner.token)).expect(200);
      expect(ownerList.body.items.filter((item: { id: string }) => item.id === created.project.id)).toHaveLength(1);
      expect(ownerList.body.items.find((item: { id: string }) => item.id === created.project.id).access).toBe('OWNER');
      const editorList = await request(app.getHttpServer()).get('/projects').set(authenticated(editor.token)).expect(200);
      expect(editorList.body.items).toEqual([expect.objectContaining({ id: created.project.id, access: 'EDITOR' })]);
      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).set(authenticated(editor.token)).expect(200);
      const saved = await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(editor.token)).send({ baseStorageVersion: 0, document: documentPayload('EditorClass') }).expect(200);
      expect(saved.body.storageVersion).toBe(1);
      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).set(authenticated(unrelated.token)).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
      await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(unrelated.token)).send({ baseStorageVersion: 1, document: documentPayload('Hidden') }).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
    });

    it('allows only owners to administer metadata and deletion while concealing unrelated projects', async () => {
      const owner = await user();
      const editor = await user();
      const unrelated = await user();
      const created = await project(owner.token);
      await prisma.projectMembership.create({ data: { projectId: created.project.id, userId: editor.id } });
      await request(app.getHttpServer()).patch(`/projects/${created.project.id}`).set(authenticated(editor.token)).send({ baseStorageVersion: 0, name: 'Nope' }).expect(403).expect(({ body }) => expect(body.error.code).toBe('FORBIDDEN'));
      await request(app.getHttpServer()).delete(`/projects/${created.project.id}?baseStorageVersion=0`).set(authenticated(editor.token)).expect(403);
      await request(app.getHttpServer()).patch(`/projects/${created.project.id}`).set(authenticated(unrelated.token)).send({ baseStorageVersion: 0, name: 'Hidden' }).expect(404);
      await request(app.getHttpServer()).delete(`/projects/${created.project.id}?baseStorageVersion=0`).set(authenticated(unrelated.token)).expect(404);
      await request(app.getHttpServer()).patch(`/projects/${created.project.id}`).set(authenticated(owner.token)).send({ baseStorageVersion: 0, name: 'Renamed' }).expect(200);
      await request(app.getHttpServer()).delete(`/projects/${created.project.id}?baseStorageVersion=1`).set(authenticated(owner.token)).expect(204);
      projectIds.delete(created.project.id);
    });

    it('conceals null-owner legacy rows and preserves membership constraints', async () => {
      const owner = await user();
      const editor = await user();
      const legacyId = randomUUID();
      projectIds.add(legacyId);
      await prisma.project.create({ data: { id: legacyId, name: 'Legacy', revision: 0, model: { packages: [], classes: [], enumerations: [], relationships: [] }, layout: { nodes: [] } } });
      await request(app.getHttpServer()).get('/projects').set(authenticated(owner.token)).expect(({ body }) => expect(body.items.map((item: { id: string }) => item.id)).not.toContain(legacyId));
      await request(app.getHttpServer()).get(`/projects/${legacyId}`).set(authenticated(owner.token)).expect(404);
      expect((await prisma.project.findUniqueOrThrow({ where: { id: legacyId } })).ownerId).toBeNull();

      const created = await project(owner.token, 'Membership');
      const membership = await prisma.projectMembership.create({ data: { projectId: created.project.id, userId: editor.id } });
      expect(membership.createdAt).toBeInstanceOf(Date);
      await expect(prisma.projectMembership.create({ data: { projectId: created.project.id, userId: editor.id } })).rejects.toMatchObject({ code: 'P2002' });
      await expect(prisma.user.delete({ where: { id: editor.id } })).rejects.toMatchObject({ code: 'P2003' });
      await expect(prisma.user.delete({ where: { id: owner.id } })).rejects.toMatchObject({ code: 'P2003' });
      await prisma.project.delete({ where: { id: created.project.id } });
      projectIds.delete(created.project.id);
      expect(await prisma.projectMembership.count({ where: { projectId: created.project.id } })).toBe(0);
    });

    it('preserves CAS for owner/editor competition and denies a member removed before saving', async () => {
      const owner = await user();
      const editor = await user();
      const created = await project(owner.token, 'CAS');
      await prisma.projectMembership.create({ data: { projectId: created.project.id, userId: editor.id } });
      const responses = await Promise.all([
        request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(owner.token)).send({ baseStorageVersion: 0, document: documentPayload('OwnerClass') }),
        request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(editor.token)).send({ baseStorageVersion: 0, document: documentPayload('EditorClass') }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      await prisma.projectMembership.delete({ where: { projectId_userId: { projectId: created.project.id, userId: editor.id } } });
      await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).set(authenticated(editor.token)).send({ baseStorageVersion: 1, document: documentPayload('Revoked') }).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
    });

    it('retains owner metadata CAS competition and stale delete protection', async () => {
      const owner = await user();
      const metadataProject = await project(owner.token, 'Metadata concurrency');
      const metadataResponses = await Promise.all([
        request(app.getHttpServer()).patch(`/projects/${metadataProject.project.id}`).set(authenticated(owner.token)).send({ baseStorageVersion: 0, name: 'First' }),
        request(app.getHttpServer()).patch(`/projects/${metadataProject.project.id}`).set(authenticated(owner.token)).send({ baseStorageVersion: 0, name: 'Second' }),
      ]);
      expect(metadataResponses.map((response) => response.status).sort()).toEqual([200, 409]);
      const reloadedMetadata = await request(app.getHttpServer()).get(`/projects/${metadataProject.project.id}`).set(authenticated(owner.token)).expect(200);
      expect(reloadedMetadata.body.storageVersion).toBe(1);
      expect(['First', 'Second']).toContain(reloadedMetadata.body.project.metadata.name);

      const stale = await project(owner.token, 'Stale delete');
      await request(app.getHttpServer()).patch(`/projects/${stale.project.id}`).set(authenticated(owner.token)).send({ baseStorageVersion: 0, name: 'Version one' }).expect(200);
      await request(app.getHttpServer()).delete(`/projects/${stale.project.id}?baseStorageVersion=0`).set(authenticated(owner.token)).expect(409).expect(({ body }) => expect(body.error.code).toBe('PROJECT_REVISION_CONFLICT'));
      await request(app.getHttpServer()).get(`/projects/${stale.project.id}`).set(authenticated(owner.token)).expect(200).expect(({ body }) => expect(body.storageVersion).toBe(1));
      await request(app.getHttpServer()).delete(`/projects/${stale.project.id}?baseStorageVersion=1`).set(authenticated(owner.token)).expect(204);
      projectIds.delete(stale.project.id);
      await request(app.getHttpServer()).delete(`/projects/${stale.project.id}?baseStorageVersion=1`).set(authenticated(owner.token)).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
    });
  });
}
