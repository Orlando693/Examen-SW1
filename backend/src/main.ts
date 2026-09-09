import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { ProjectErrorFilter } from './projects/project-error.filter.js';

const DEFAULT_BACKEND_PORT = 3001;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
const PROJECT_PAYLOAD_LIMIT_BYTES = 1_048_576;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: PROJECT_PAYLOAD_LIMIT_BYTES }),
  );

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ProjectErrorFilter());

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
  });

  const port = Number(process.env.BACKEND_PORT ?? DEFAULT_BACKEND_PORT);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
