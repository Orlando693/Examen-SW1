import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator.js';

export interface HealthResponse {
  status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
