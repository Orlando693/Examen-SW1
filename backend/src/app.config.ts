import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ProjectErrorFilter } from './projects/project-error.filter.js';

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
