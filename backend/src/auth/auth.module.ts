import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { BearerAuthGuard } from './bearer-auth.guard.js';
import { UsersRepository } from './users.repository.js';
import { AccessTokenAuthenticator } from './access-token-authenticator.js';

const ttlSeconds = Number(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS ?? 3600);

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET ?? 'missing-jwt-secret', signOptions: { expiresIn: ttlSeconds } })],
  controllers: [AuthController],
  providers: [UsersRepository, AuthService, AccessTokenAuthenticator, BearerAuthGuard, { provide: APP_GUARD, useExisting: BearerAuthGuard }],
  exports: [AuthService, AccessTokenAuthenticator],
})
export class AuthModule {}
