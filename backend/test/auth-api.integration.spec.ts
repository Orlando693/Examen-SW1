import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.config.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!testDatabaseUrl) {
  describe.skip('PostgreSQL authentication API', () => { it('requires TEST_DATABASE_URL', () => {}); });
} else {
  describe('PostgreSQL authentication API', () => {
    const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    const emails = new Set<string>();
    let app: NestFastifyApplication;

    beforeAll(async () => { await prisma.$connect(); });
    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prisma).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      configureApplication(app);
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });
    afterEach(async () => {
      await app.close();
      await prisma.user.deleteMany({ where: { email: { in: [...emails] } } });
      emails.clear();
    });
    afterAll(async () => { await prisma.$disconnect(); });

    it('keeps health public and registers, logs in, and reads a safe current user', async () => {
      await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
      const email = `person-${randomUUID()}@example.com`;
      const password = 'password-with-eight-characters';
      emails.add(email);
      const registered = await request(app.getHttpServer()).post('/auth/register').send({ email: ` ${email.toUpperCase()} `, password }).expect(201);
      expect(registered.body).toMatchObject({ accessToken: expect.any(String), user: { id: expect.any(String), email } });
      expect(UUID_PATTERN.test(registered.body.user.id)).toBe(true);
      expect(registered.body).not.toHaveProperty('passwordHash');
      expect(registered.body).not.toHaveProperty('password');

      const persisted = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(persisted.id).toBe(registered.body.user.id);
      expect(UUID_PATTERN.test(persisted.id)).toBe(true);
      expect(persisted.email).toBe(email);
      expect(persisted.passwordHash).toMatch(/^\$argon2id\$/);
      expect(persisted.passwordHash).not.toBe(password);
      expect(await argon2.verify(persisted.passwordHash, password)).toBe(true);
      expect('password' in persisted).toBe(false);

      const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
      expect(login.body.user).toEqual(registered.body.user);
      const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
      expect(me.body).toEqual(registered.body.user);
      expect(me.body).not.toHaveProperty('passwordHash');
      expect(me.body).not.toHaveProperty('password');
    });

    it('rejects untrusted fields, duplicate normalized email, invalid credentials, and invalid bearer tokens safely', async () => {
      const email = `person-${randomUUID()}@example.com`;
      emails.add(email);
      await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters', id: randomUUID() }).expect(400).expect(({ body }) => expect(body.error.code).toBe('INVALID_REQUEST'));
      await request(app.getHttpServer()).post('/auth/register').send({ email, password: 'password-with-eight-characters' }).expect(201);
      await request(app.getHttpServer()).post('/auth/register').send({ email: email.toUpperCase(), password: 'password-with-eight-characters' }).expect(409).expect(({ body }) => expect(body.error.code).toBe('EMAIL_ALREADY_REGISTERED'));
      const unknown = await request(app.getHttpServer()).post('/auth/login').send({ email: `unknown-${randomUUID()}@example.com`, password: 'password-with-eight-characters' }).expect(401);
      const wrong = await request(app.getHttpServer()).post('/auth/login').send({ email, password: 'wrong-password' }).expect(401);
      expect(unknown.body.error).toEqual(wrong.body.error);
      await request(app.getHttpServer()).get('/auth/me').expect(401).expect(({ body }) => expect(body.error.code).toBe('AUTHENTICATION_REQUIRED'));
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer malformed').expect(401).expect(({ body }) => expect(body.error.code).toBe('AUTHENTICATION_REQUIRED'));
      const expired = await app.get(JwtService).signAsync({ sub: randomUUID() }, { expiresIn: -1 });
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${expired}`).expect(401).expect(({ body }) => expect(body.error.code).toBe('AUTHENTICATION_REQUIRED'));
    });
  });
}
