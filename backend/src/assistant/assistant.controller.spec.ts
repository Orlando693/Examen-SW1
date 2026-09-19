import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { configureApplication } from '../app.config.js';

describe('AssistantController', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => { await app?.close(); });

  it('requires bearer authentication before interpreting a project request', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApplication(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await request(app.getHttpServer()).post('/projects/00000000-0000-4000-8000-000000000000/assistant/interpret').send({ text: 'Create Customer' }).expect(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const streamResponse = await request(app.getHttpServer()).post('/projects/00000000-0000-4000-8000-000000000000/assistant/interpret/stream').send({ text: 'Create Customer' }).expect(401);
    expect(streamResponse.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });
});
