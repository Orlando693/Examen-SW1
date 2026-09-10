import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { configureApplication, validateEnvironment } from './app.config.js';

const DEFAULT_BACKEND_PORT = 3001;
const PROJECT_PAYLOAD_LIMIT_BYTES = 1_048_576;

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: PROJECT_PAYLOAD_LIMIT_BYTES }),
  );

  configureApplication(app);

  const port = Number(process.env.BACKEND_PORT ?? DEFAULT_BACKEND_PORT);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
