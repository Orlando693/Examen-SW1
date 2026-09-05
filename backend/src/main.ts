import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

const DEFAULT_BACKEND_PORT = 3001;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
  });

  const port = Number(process.env.BACKEND_PORT ?? DEFAULT_BACKEND_PORT);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
