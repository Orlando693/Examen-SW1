import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SafeUser } from './users.repository.js';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SafeUser => {
  return context.switchToHttp().getRequest<{ user: SafeUser }>().user;
});
