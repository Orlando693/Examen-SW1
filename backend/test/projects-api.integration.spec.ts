import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ProjectErrorFilter } from '../src/projects/project-error.filter.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const payloadLimit = 1_048_576;

function assertIsolatedTestDatabase(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'postgresql:' || url.hostname !== 'localhost' || url.port !== '5432' || url.pathname !== '/examen_sw1_test') {
    throw new Error('TEST_DATABASE_URL must target the isolated local integration database.');
  }
}

if (!testDatabaseUrl) {
  describe.skip('PostgreSQL projects API', () => {
    it('requires TEST_DATABASE_URL and migrations applied to an isolated database', () => {});
  });
} else {
  describe('PostgreSQL projects API', () => {
    assertIsolatedTestDatabase(testDatabaseUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    const projectIds = new Set<string>();
    let app: NestFastifyApplication;

    beforeAll(async () => {
      await prisma.$connect();
    });

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ bodyLimit: payloadLimit }));
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
      app.useGlobalFilters(new ProjectErrorFilter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterEach(async () => {
      await app.close();
      await prisma.project.deleteMany({ where: { id: { in: [...projectIds] } } });
      projectIds.clear();
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    async function createProject(name = 'Project API') {
      const response = await request(app.getHttpServer()).post('/projects').send({ name }).expect(201);
      projectIds.add(response.body.project.id);
      return response.body;
    }

    it('creates, lists, retrieves, saves, patches and deletes exact project resource shapes', async () => {
      const created = await createProject();
      expect(created).toMatchObject({ storageVersion: 0, documentSchemaVersion: 1, project: { metadata: { name: 'Project API' }, revision: 0 } });
      expect(Object.keys(created).sort()).toEqual(['documentSchemaVersion', 'project', 'storageVersion']);

      const listed = await request(app.getHttpServer()).get('/projects').expect(200);
      const summary = listed.body.items.find((item: { id: string }) => item.id === created.project.id);
      expect(summary).toMatchObject({ id: created.project.id, name: 'Project API', description: null, storageVersion: 0 });
      expect(Object.keys(summary).sort()).toEqual(['createdAt', 'description', 'id', 'name', 'storageVersion', 'updatedAt']);

      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).expect(200).expect(created);
      const saved = await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).send({
        baseStorageVersion: 0,
        document: {
          revision: 1,
          model: { packages: [], classes: [{ id: 'class-1', name: 'person', attributes: [], operations: [] }], enumerations: [], relationships: [] },
          layout: { nodes: [] },
        },
      }).expect(200);
      expect(saved.body.storageVersion).toBe(1);
      expect(saved.body.project.revision).toBe(1);

      const patched = await request(app.getHttpServer()).patch(`/projects/${created.project.id}`).send({ baseStorageVersion: 1, description: null, name: 'Renamed' }).expect(200);
      expect(patched.body).toMatchObject({ storageVersion: 2, project: { metadata: { name: 'Renamed' } } });
      expect(patched.body.project.metadata.description).toBeUndefined();
      await request(app.getHttpServer()).delete(`/projects/${created.project.id}?baseStorageVersion=2`).expect(204);
      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
    });

    it('rejects invalid fields, identifiers, versions, empty patches and oversized payloads', async () => {
      await request(app.getHttpServer()).post('/projects').send({ name: 'Allowed', ownerId: randomUUID() }).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).get('/projects/not-a-uuid').expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      const created = await createProject('Validation');
      await request(app.getHttpServer()).patch(`/projects/${created.project.id}`).send({ baseStorageVersion: 0 }).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).delete(`/projects/${created.project.id}?baseStorageVersion=-1`).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).send({ baseStorageVersion: 0.5, document: {} }).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).post('/projects').send({ name: 'x'.repeat(payloadLimit) }).expect(413).expect(({ body }) => expect(body.error.code).toBe('PAYLOAD_TOO_LARGE'));
    });

    it('accepts semantic warnings, rejects blocking semantic errors, and filters corrupt stored JSONB', async () => {
      const created = await createProject('Validation cases');
      const warningSave = await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).send({
        baseStorageVersion: 0,
        document: { revision: 1, model: { packages: [], classes: [{ id: 'class-1', name: 'lowercase', attributes: [], operations: [] }], enumerations: [], relationships: [] }, layout: { nodes: [] } },
      }).expect(200);
      expect(warningSave.body.storageVersion).toBe(1);
      await request(app.getHttpServer()).put(`/projects/${created.project.id}/document`).send({
        baseStorageVersion: 1,
        document: { revision: 2, model: { packages: [], classes: [{ id: 'class-2', name: '', attributes: [], operations: [] }], enumerations: [], relationships: [] }, layout: { nodes: [] } },
      }).expect(422).expect(({ body }) => expect(body.error.code).toBe('DOCUMENT_VALIDATION_FAILED'));
      await prisma.project.update({ where: { id: created.project.id }, data: { model: { corrupt: true } } });
      await request(app.getHttpServer()).get(`/projects/${created.project.id}`).expect(500).expect(({ body }) => {
        expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: {} });
      });
      const semanticCorruption = await createProject('Semantic corruption');
      await prisma.project.update({
        where: { id: semanticCorruption.project.id },
        data: { model: { packages: [], classes: [{ id: 'class-1', name: '', attributes: [], operations: [] }], enumerations: [], relationships: [] } },
      });
      await request(app.getHttpServer()).get(`/projects/${semanticCorruption.project.id}`).expect(500).expect(({ body }) => {
        expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: {} });
      });
      const unsupported = await createProject('Unsupported format');
      await prisma.project.update({ where: { id: unsupported.project.id }, data: { documentSchemaVersion: 2 } });
      await request(app.getHttpServer()).get(`/projects/${unsupported.project.id}`).expect(422).expect(({ body }) => expect(body.error.code).toBe('UNSUPPORTED_DOCUMENT_SCHEMA_VERSION'));
    });

    it('allows exactly one concurrent document and metadata CAS write and leaves stale data unchanged', async () => {
      const documentProject = await createProject('Document concurrency');
      const documentPayload = (name: string) => ({ baseStorageVersion: 0, document: { revision: 1, model: { packages: [], classes: [{ id: `class-${name}`, name, attributes: [], operations: [] }], enumerations: [], relationships: [] }, layout: { nodes: [] } } });
      const documentResponses = await Promise.all([
        request(app.getHttpServer()).put(`/projects/${documentProject.project.id}/document`).send(documentPayload('First')),
        request(app.getHttpServer()).put(`/projects/${documentProject.project.id}/document`).send(documentPayload('Second')),
      ]);
      expect(documentResponses.map((response) => response.status).sort()).toEqual([200, 409]);
      const reloadedDocument = await request(app.getHttpServer()).get(`/projects/${documentProject.project.id}`).expect(200);
      expect(reloadedDocument.body.storageVersion).toBe(1);
      expect(['First', 'Second']).toContain(reloadedDocument.body.project.model.classes[0].name);

      const metadataProject = await createProject('Metadata concurrency');
      const metadataResponses = await Promise.all([
        request(app.getHttpServer()).patch(`/projects/${metadataProject.project.id}`).send({ baseStorageVersion: 0, name: 'First' }),
        request(app.getHttpServer()).patch(`/projects/${metadataProject.project.id}`).send({ baseStorageVersion: 0, name: 'Second' }),
      ]);
      expect(metadataResponses.map((response) => response.status).sort()).toEqual([200, 409]);
      const reloadedMetadata = await request(app.getHttpServer()).get(`/projects/${metadataProject.project.id}`).expect(200);
      expect(reloadedMetadata.body.storageVersion).toBe(1);
      expect(['First', 'Second']).toContain(reloadedMetadata.body.project.metadata.name);
    });

    it('performs conditional stale deletion without deleting the current project', async () => {
      const stale = await createProject('Stale delete');
      await request(app.getHttpServer()).patch(`/projects/${stale.project.id}`).send({ baseStorageVersion: 0, name: 'Version one' }).expect(200);
      await request(app.getHttpServer()).delete(`/projects/${stale.project.id}?baseStorageVersion=0`).expect(409).expect(({ body }) => expect(body.error.code).toBe('PROJECT_REVISION_CONFLICT'));
      await request(app.getHttpServer()).get(`/projects/${stale.project.id}`).expect(200).expect(({ body }) => expect(body.storageVersion).toBe(1));
      await request(app.getHttpServer()).delete(`/projects/${stale.project.id}?baseStorageVersion=1`).expect(204);
      await request(app.getHttpServer()).delete(`/projects/${stale.project.id}?baseStorageVersion=1`).expect(404).expect(({ body }) => expect(body.error.code).toBe('PROJECT_NOT_FOUND'));
    });
  });
}
