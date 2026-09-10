import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppModule } from './app.module.js';
import { configureApplication } from './app.config.js';

describe('GET /health', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApplication(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a healthy response', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('accepts project API preflight requests from the configured frontend origin', async () => {
    await request(app.getHttpServer())
      .options('/projects')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'PATCH')
      .expect(204)
      .expect('access-control-allow-origin', 'http://localhost:3000')
      .expect('access-control-allow-methods', /GET.*POST.*PUT.*PATCH.*DELETE.*OPTIONS/);
  });
});
