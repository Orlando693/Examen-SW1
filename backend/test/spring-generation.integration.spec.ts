import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { createWriteStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import request from 'supertest';
import type { Response } from 'superagent';
import { fromBuffer } from 'yauzl';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.config.js';
import { SPRING_GENERATION_TEMP_ROOT } from '../src/generations/spring-generation.service.js';
import { SPRING_ZIP_ARCHIVER, YazlSpringZipArchiver, type SpringZipArchiver } from '../src/generations/spring-zip-archiver.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function assertIsolatedTestDatabase(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'postgresql:' || url.hostname !== 'localhost' || url.port !== '5432' || url.pathname !== '/examen_sw1_test') throw new Error('TEST_DATABASE_URL must target the isolated local integration database.');
}

function liveModel(firstName = 'Cliente') {
  return {
    packages: [],
    classes: [
      { id: 'cliente', name: firstName, attributes: [{ id: 'nombre', name: 'nombre', visibility: 'private', type: { kind: 'primitive', name: 'string' } }], operations: [] },
      { id: 'pedido', name: 'Pedido', attributes: [], operations: [] },
    ],
    enumerations: [],
    relationships: [{ id: 'cliente-pedidos', kind: 'association', source: { classId: 'cliente', multiplicity: { lower: 1, upper: 1 } }, target: { classId: 'pedido', multiplicity: { lower: 0, upper: '*' } } }],
  };
}

function binaryParser(response: Response, callback: (error: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
}

function zipEntries(buffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error('ZIP could not be opened.'));
      const entries: string[] = [];
      zip.on('entry', (entry) => { entries.push(entry.fileName); zip.readEntry(); });
      zip.on('end', () => resolve(entries));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

function extractZip(buffer: Buffer, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error('ZIP could not be opened.'));
      zip.on('entry', (entry) => {
        const parts: string[] = entry.fileName.split('/');
        if (parts.some((part) => part === '' || part === '.' || part === '..')) return reject(new Error(`Unsafe ZIP entry: ${entry.fileName}`));
        const output = join(destination, ...parts);
        if (entry.fileName.endsWith('/')) {
          void mkdir(output, { recursive: true }).then(() => zip.readEntry(), reject);
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error(`ZIP entry could not be read: ${entry.fileName}`));
          void mkdir(dirname(output), { recursive: true })
            .then(() => pipeline(stream, createWriteStream(output)))
            .then(() => zip.readEntry(), reject);
        });
      });
      zip.on('end', resolve);
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

const execFileAsync = promisify(execFile);

async function verifyExtractedGradleProject(root: string): Promise<void> {
  const java = await execFileAsync('java', ['--version']);
  if (!/^openjdk 21\./m.test(java.stdout)) throw new Error(`Java 21 is required; detected: ${java.stdout.trim()}`);
  for (const task of ['test', 'build']) {
    try {
      await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', `call gradlew.bat --no-daemon ${task}`], { cwd: root, timeout: 180_000, maxBuffer: 256 * 1024, windowsHide: true });
    } catch (cause) {
      const failure = cause as { killed?: boolean; signal?: string; stderr?: string; stdout?: string; message: string };
      if (failure.killed || failure.signal === 'SIGTERM') throw new Error(`Generated Gradle wrapper ${task} timed out after 180000 ms.`);
      throw new Error(`Generated Gradle wrapper ${task} failed: ${(failure.stderr ?? failure.stdout ?? failure.message).slice(0, 8192)}`);
    }
  }
}

async function waitForTemporaryCleanup(parent: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await readdir(parent)).length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(await readdir(parent)).toEqual([]);
}

if (!testDatabaseUrl) {
  describe.skip('PostgreSQL Spring generation API', () => { it('requires TEST_DATABASE_URL', () => {}); });
} else {
  describe('PostgreSQL Spring generation API', () => {
    assertIsolatedTestDatabase(testDatabaseUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    const projectIds = new Set<string>();
    const emails = new Set<string>();
    let app: NestFastifyApplication;
    let temporaryParent: string;
    let archiveFailure = false;

    beforeAll(async () => { await prisma.$connect(); });
    beforeEach(async () => {
      temporaryParent = await mkdtemp(join(tmpdir(), 'examen-sw1-spring-test-'));
      const archiver: SpringZipArchiver = {
        archive: async (entries, destination) => {
          if (archiveFailure) throw new Error('forced archive failure');
          await new YazlSpringZipArchiver().archive(entries, destination);
        },
      };
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService).useValue(prisma)
        .overrideProvider(SPRING_ZIP_ARCHIVER).useValue(archiver)
        .overrideProvider(SPRING_GENERATION_TEMP_ROOT).useValue(temporaryParent)
        .compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      configureApplication(app);
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });
    afterEach(async () => {
      await app.close();
      await prisma.project.deleteMany({ where: { id: { in: [...projectIds] } } });
      await prisma.user.deleteMany({ where: { email: { in: [...emails] } } });
      await rm(temporaryParent, { recursive: true, force: true });
      projectIds.clear();
      emails.clear();
      archiveFailure = false;
    });
    afterAll(async () => { await prisma.$disconnect(); });

    async function user() {
      const email = `spring-${randomUUID()}@example.com`;
      emails.add(email);
      const response = await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters' }).expect(201);
      return { id: response.body.user.id as string, token: response.body.accessToken as string };
    }
    const authenticated = (token: string) => ({ Authorization: `Bearer ${token}` });
    async function project(token: string, name = 'Pedidos') {
      const response = await request(app.getHttpServer()).post('/projects').set(authenticated(token)).send({ name }).expect(201);
      projectIds.add(response.body.project.id);
      return response.body;
    }
    async function save(token: string, id: string, baseStorageVersion: number, firstName = 'Cliente') {
      return request(app.getHttpServer()).put(`/projects/${id}/document`).set(authenticated(token)).send({ baseStorageVersion, document: { revision: 1, model: liveModel(firstName), layout: { nodes: [] } } }).expect(200);
    }
    function generate(token: string, id: string) {
      return request(app.getHttpServer()).post(`/projects/${id}/generations/spring`).set(authenticated(token)).buffer(true).parse(binaryParser);
    }
    const errorBody = (body: Buffer) => JSON.parse(body.toString()) as { error: { code: string; details: object } };

    it('returns CORS headers for Spring generation preflight, ZIP download, and errors', async () => {
      const owner = await user();
      const created = await project(owner.token);
      await save(owner.token, created.project.id, 0);
      const origin = 'http://localhost:3000';

      const preflight = await request(app.getHttpServer())
        .options(`/projects/${created.project.id}/generations/spring`)
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization')
        .expect(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(origin);
      expect(preflight.headers['access-control-allow-methods']).toContain('POST');
      expect(preflight.headers['access-control-allow-headers']).toContain('Authorization');

      const download = await generate(owner.token, created.project.id).set('Origin', origin).expect(200);
      expect(download.headers['access-control-allow-origin']).toBe(origin);
      expect(download.headers['access-control-expose-headers']).toContain('Content-Disposition');
      expect(download.headers['content-type']).toContain('application/zip');
      expect((download.body as Buffer).subarray(0, 4).toString()).toBe('PK\u0003\u0004');

      const denied = await generate(owner.token, randomUUID()).set('Origin', origin).expect(404);
      expect(denied.headers['access-control-allow-origin']).toBe(origin);
      await waitForTemporaryCleanup(temporaryParent);
    }, 30_000);

    it('streams a complete ZIP from only the saved Cliente/Pedido UML and cleans its temporary root', async () => {
      const owner = await user();
      const created = await project(owner.token);
      await save(owner.token, created.project.id, 0);
      const response = await generate(owner.token, created.project.id).expect(200);
      expect(response.headers['content-type']).toContain('application/zip');
      expect(response.headers['content-disposition']).toMatch(/^attachment; filename="pedidos-[a-f0-9]{12}\.zip"$/);
      const entries = await zipEntries(response.body as Buffer);
      expect(entries).toEqual(expect.arrayContaining([
        expect.stringMatching(/^pedidos-[a-f0-9]{12}\/build\.gradle$/),
        expect.stringMatching(/\/domain\/Cliente\.java$/),
        expect.stringMatching(/\/domain\/Pedido\.java$/),
        expect.stringMatching(/\/api\/ClienteController\.java$/),
      ]));
      expect(entries.every((entry) => !entry.includes('..') && !entry.startsWith('/'))).toBe(true);
      await waitForTemporaryCleanup(temporaryParent);
    }, 30_000);

    it('extracts the persisted Cliente/Pedido endpoint ZIP and verifies its generated Gradle wrapper', async () => {
      const owner = await user();
      const created = await project(owner.token);
      await save(owner.token, created.project.id, 0);
      const response = await generate(owner.token, created.project.id).expect(200);
      const extractionRoot = await mkdtemp(join(tmpdir(), 'examen-sw1-spring-download-'));
      try {
        const entries = await zipEntries(response.body as Buffer);
        const buildFile = entries.find((entry) => entry.endsWith('/build.gradle'));
        expect(buildFile).toBeDefined();
        await extractZip(response.body as Buffer, extractionRoot);
        await verifyExtractedGradleProject(join(extractionRoot, buildFile!.split('/')[0]!));
      } finally {
        await rm(extractionRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      }
    }, 400_000);

    it('uses the latest saved model rather than a fixture and enforces authentication/access concealment', async () => {
      const owner = await user();
      const unrelated = await user();
      const created = await project(owner.token);
      await save(owner.token, created.project.id, 0, 'Cliente');
      const first = await generate(owner.token, created.project.id).expect(200);
      await save(owner.token, created.project.id, 1, 'Producto');
      const second = await generate(owner.token, created.project.id).expect(200);
      expect((await zipEntries(first.body as Buffer)).some((entry) => /\/Cliente\.java$/.test(entry))).toBe(true);
      expect((await zipEntries(second.body as Buffer)).some((entry) => /\/Producto\.java$/.test(entry))).toBe(true);
      expect((await zipEntries(second.body as Buffer)).some((entry) => /\/Cliente\.java$/.test(entry))).toBe(false);
      await request(app.getHttpServer()).post(`/projects/${created.project.id}/generations/spring`).expect(401);
      await generate(unrelated.token, created.project.id).expect(404).expect(({ body }) => expect(errorBody(body as Buffer).error.code).toBe('PROJECT_NOT_FOUND'));
    }, 30_000);

    it('returns bounded failures for invalid persisted model/metadata and archive failure, always cleaning temporary output', async () => {
      const owner = await user();
      const invalidMetadata = await project(owner.token, '!!!');
      await generate(owner.token, invalidMetadata.project.id).expect(422).expect(({ body }) => expect(errorBody(body as Buffer).error).toMatchObject({ code: 'GENERATION_VALIDATION_FAILED', details: { diagnostics: [{ code: 'INVALID_GENERATION_METADATA' }] } }));
      const invalidModel = await project(owner.token, 'Invalid model');
      await prisma.project.update({ where: { id: invalidModel.project.id }, data: { model: { malformed: true } } });
      await generate(owner.token, invalidModel.project.id).expect(500).expect(({ body }) => expect(errorBody(body as Buffer).error.code).toBe('INTERNAL_ERROR'));
      const archiveProject = await project(owner.token, 'Archive failure');
      await save(owner.token, archiveProject.project.id, 0);
      archiveFailure = true;
      await generate(owner.token, archiveProject.project.id).expect(500).expect(({ body }) => expect(errorBody(body as Buffer).error.code).toBe('GENERATION_FAILED'));
      await waitForTemporaryCleanup(temporaryParent);
    }, 15_000);
  });
}
