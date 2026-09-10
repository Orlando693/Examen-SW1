import { Body, Controller, Get, HttpCode, Inject, Post, ValidationPipe } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator.js';
import { AuthService, type AuthResponse } from './auth.service.js';
import { CredentialsDto } from './auth.dto.js';
import { Public } from './public.decorator.js';
import type { SafeUser } from './users.repository.js';

const credentialsPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: CredentialsDto });

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(credentialsPipe) input: CredentialsDto): Promise<AuthResponse> {
    return this.auth.register(input.email, input.password);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(credentialsPipe) input: CredentialsDto): Promise<AuthResponse> {
    return this.auth.login(input.email, input.password);
  }

  @Get('me')
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }
}
