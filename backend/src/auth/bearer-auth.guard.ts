import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthenticationRequiredError } from './auth.errors.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ') || header.length <= 'Bearer '.length) throw new AuthenticationRequiredError();
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(header.slice('Bearer '.length));
      if (typeof payload.sub !== 'string') throw new Error('Missing subject');
      const user = await this.auth.currentUser(payload.sub);
      if (!user) throw new Error('Unknown user');
      request.user = user;
      return true;
    } catch {
      throw new AuthenticationRequiredError();
    }
  }
}
