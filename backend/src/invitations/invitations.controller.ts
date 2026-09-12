import { Body, Controller, Get, HttpCode, Inject, Param, Post, ValidationPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectIdParamsDto } from '../projects/projects.dto.js';
import { CreateInvitationDto, ProjectInvitationParamsDto, InvitationTokenDto } from './invitations.dto.js';
import { InvitationsService } from './invitations.service.js';

const options = { transform: true, whitelist: true, forbidNonWhitelisted: true };
const projectPipe = new ValidationPipe({ ...options, expectedType: ProjectIdParamsDto });
const createPipe = new ValidationPipe({ ...options, expectedType: CreateInvitationDto });
const tokenPipe = new ValidationPipe({ ...options, expectedType: InvitationTokenDto });
const invitationPipe = new ValidationPipe({ ...options, expectedType: ProjectInvitationParamsDto });

@Controller()
export class InvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}
  @Post('projects/:id/invitations') create(@CurrentUser() user: SafeUser, @Param(projectPipe) params: ProjectIdParamsDto, @Body(createPipe) input: CreateInvitationDto) { return this.invitations.create(user, params.id, input.email); }
  @Get('projects/:id/invitations') list(@CurrentUser() user: SafeUser, @Param(projectPipe) params: ProjectIdParamsDto) { return this.invitations.list(user, params.id); }
  @Post('projects/:id/invitations/:invitationId/revoke') @HttpCode(204) async revoke(@CurrentUser() user: SafeUser, @Param(invitationPipe) params: ProjectInvitationParamsDto) { await this.invitations.revoke(user, params.id, params.invitationId); }
  @Post('invitations/inspect') inspect(@CurrentUser() user: SafeUser, @Body(tokenPipe) input: InvitationTokenDto) { return this.invitations.inspect(user, input.token); }
  @Post('invitations/accept') @HttpCode(204) async accept(@CurrentUser() user: SafeUser, @Body(tokenPipe) input: InvitationTokenDto) { await this.invitations.accept(user, input.token); }
  @Post('invitations/reject') @HttpCode(204) async reject(@CurrentUser() user: SafeUser, @Body(tokenPipe) input: InvitationTokenDto) { await this.invitations.reject(user, input.token); }
}
