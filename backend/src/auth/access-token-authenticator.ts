import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticationRequiredError } from './auth.errors.js';
import { AuthService } from './auth.service.js';
import type { SafeUser } from './users.repository.js';

export interface AuthenticatedAccessToken {
  user: SafeUser;
  expiresAt: number;
}

@Injectable()
export class AccessTokenAuthenticator {
  constructor(@Inject(JwtService) private readonly jwt: JwtService, @Inject(AuthService) private readonly auth: AuthService) {}

  async authenticate(token: string): Promise<AuthenticatedAccessToken> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; exp?: number }>(token);
      if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') throw new Error('Invalid access token payload');
      const user = await this.auth.currentUser(payload.sub);
      if (!user) throw new Error('Unknown user');
      return { user, expiresAt: payload.exp * 1000 };
    } catch {
      throw new AuthenticationRequiredError();
    }
  }

  async revalidate(user: SafeUser, expiresAt: number): Promise<SafeUser> {
    if (Date.now() >= expiresAt || !(await this.auth.currentUser(user.id))) throw new AuthenticationRequiredError();
    return user;
  }
}
