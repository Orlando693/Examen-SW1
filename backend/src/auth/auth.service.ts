import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { DuplicateEmailError, InvalidCredentialsError } from './auth.errors.js';
import { type SafeUser, UsersRepository } from './users.repository.js';

export interface AuthResponse {
  accessToken: string;
  user: SafeUser;
}

const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$RG9Ob1RVU0VUaW5QYXNzd29yZA$KRd1HfY6xB81KVbW0l0w0Zl5bBZo4Mynoj8XPWDoJF8';

@Injectable()
export class AuthService {
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository, @Inject(JwtService) private readonly jwt: JwtService) {}

  async register(email: string, password: string): Promise<AuthResponse> {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    try {
      const user = await this.users.create(email, passwordHash);
      return this.responseFor(user);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new DuplicateEmailError();
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    const valid = await argon2.verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password).catch(() => false);
    if (!user || !valid) throw new InvalidCredentialsError();
    return this.responseFor(user);
  }

  async currentUser(id: string): Promise<SafeUser | null> {
    return this.users.findSafeById(id);
  }

  private async responseFor(user: SafeUser): Promise<AuthResponse> {
    const safeUser: SafeUser = { id: user.id, email: user.email };
    return { accessToken: await this.jwt.signAsync({ sub: safeUser.id }), user: safeUser };
  }
}
