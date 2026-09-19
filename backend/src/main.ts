import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module.js';
import { configureApplication, validateEnvironment } from './app.config.js';
import { COLLABORATION_LIMITS } from './collaboration/collaboration-limits.js';
import { WAV_HTTP_PAYLOAD_BYTES } from '@examen-sw1/local-stt';

const DEFAULT_BACKEND_PORT = 3001;
async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: Math.max(COLLABORATION_LIMITS.payloadBytes, WAV_HTTP_PAYLOAD_BYTES) }),
  );

  configureApplication(app);
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = Number(process.env.BACKEND_PORT ?? DEFAULT_BACKEND_PORT);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
