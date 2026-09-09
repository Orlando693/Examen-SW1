import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  createProjectDocument,
  INITIAL_DOCUMENT_SCHEMA_VERSION,
  INITIAL_STORAGE_VERSION,
  validateProjectDocument,
} from '@examen-sw1/uml-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { toProjectPersistenceData, toProjectResource } from '../src/persistence/project-persistence.mapper.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function assertIsolatedTestDatabase(databaseUrl: string): void {
  const url = new URL(databaseUrl);

  if (url.protocol !== 'postgresql:' || url.hostname !== 'localhost' || url.port !== '5432' || url.pathname !== '/examen_sw1_test') {
    throw new Error('TEST_DATABASE_URL must target the isolated local integration database.');
  }
}

if (!testDatabaseUrl) {
  describe.skip('PostgreSQL project persistence', () => {
    it('requires TEST_DATABASE_URL and migrations applied to an isolated database', () => {});
  });
} else {
  describe('PostgreSQL project persistence', () => {
    assertIsolatedTestDatabase(testDatabaseUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    let createdProjectId: string | undefined;

    beforeAll(async () => {
      await prisma.$connect();
    });

    afterEach(async () => {
      if (createdProjectId) {
        await prisma.project.delete({ where: { id: createdProjectId } });
        createdProjectId = undefined;
      }
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it('round-trips canonical model and layout through JSONB', async () => {
      const document = createProjectDocument({
        id: randomUUID(),
        name: 'PostgreSQL round trip',
        now: '2026-09-07T00:00:00.000Z',
        layout: { nodes: [{ id: 'node-1', elementId: 'class-1', position: { x: 100, y: 200 } }] },
        model: { packages: [], classes: [{ id: 'class-1', name: 'Person', attributes: [], operations: [] }], enumerations: [], relationships: [] },
      });
      const resource = { project: document, storageVersion: INITIAL_STORAGE_VERSION, documentSchemaVersion: INITIAL_DOCUMENT_SCHEMA_VERSION };

      createdProjectId = document.id;
      await prisma.project.create({ data: toProjectPersistenceData(resource) });
      const row = await prisma.project.findUniqueOrThrow({ where: { id: document.id } });
      const reloaded = toProjectResource(row);

      expect(reloaded).toEqual(resource);
      expect(reloaded.project.model).toEqual(document.model);
      expect(reloaded.project.layout).toEqual(document.layout);
      expect(reloaded.project.revision).toBe(document.revision);
      expect(reloaded.project.timestamps).toEqual(document.timestamps);
      expect(reloaded.storageVersion).toBe(INITIAL_STORAGE_VERSION);
      expect(reloaded.documentSchemaVersion).toBe(INITIAL_DOCUMENT_SCHEMA_VERSION);
      expect(validateProjectDocument(reloaded.project).hasErrors).toBe(false);
    });
  });
}
