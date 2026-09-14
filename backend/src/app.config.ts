import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ProjectErrorFilter } from './projects/project-error.filter.js';
import { readCollaborationLimits } from './collaboration/collaboration-limits.js';

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

export const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

export function configureApplication(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ProjectErrorFilter());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
    methods: CORS_METHODS,
  });
}

export function validateEnvironment(environment = process.env): void {
  readCollaborationLimits(environment);
  if (!environment.JWT_SECRET || environment.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }
  if (environment.JWT_ACCESS_TOKEN_TTL_SECONDS && Number(environment.JWT_ACCESS_TOKEN_TTL_SECONDS) !== 3600) {
    throw new Error('JWT_ACCESS_TOKEN_TTL_SECONDS must be 3600.');
  }
}
