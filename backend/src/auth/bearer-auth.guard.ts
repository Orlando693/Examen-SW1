import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationRequiredError } from './auth.errors.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { AccessTokenAuthenticator } from './access-token-authenticator.js';

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessTokenAuthenticator) private readonly authenticator: AccessTokenAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket authentication is completed during the CollaborationGateway handshake.
    if (context.getType() !== 'http') return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ') || header.length <= 'Bearer '.length) throw new AuthenticationRequiredError();
    try {
      request.user = (await this.authenticator.authenticate(header.slice('Bearer '.length))).user;
      return true;
    } catch {
      throw new AuthenticationRequiredError();
    }
  }
}
