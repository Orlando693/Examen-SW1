import { Body, Controller, Inject, Param, Post, Req, Res, ValidationPipe } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectIdParamsDto } from '../projects/projects.dto.js';
import { AssistantService } from './assistant.service.js';
import { type AssistantInterpretationDto, InterpretAssistantDto } from './assistant.dto.js';

const validationOptions = { transform: true, whitelist: true, forbidNonWhitelisted: true };
const projectIdPipe = new ValidationPipe({ ...validationOptions, expectedType: ProjectIdParamsDto });
const interpretPipe = new ValidationPipe({ ...validationOptions, expectedType: InterpretAssistantDto });

@Controller('projects/:id/assistant')
export class AssistantController {
  constructor(@Inject(AssistantService) private readonly assistant: AssistantService) {}

  @Post('interpret')
  async interpret(
    @CurrentUser() user: SafeUser,
    @Param(projectIdPipe) params: ProjectIdParamsDto,
    @Body(interpretPipe) input: InterpretAssistantDto,
    @Req() request: FastifyRequest,
  ): Promise<AssistantInterpretationDto> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.raw.once('aborted', abort);
    if (request.raw.aborted) abort();
    try {
      return await this.assistant.interpret(user, params.id, input, controller.signal);
    } finally {
      request.raw.removeListener('aborted', abort);
    }
  }

  @Post('interpret/stream')
  async interpretStream(
    @CurrentUser() user: SafeUser,
    @Param(projectIdPipe) params: ProjectIdParamsDto,
    @Body(interpretPipe) input: InterpretAssistantDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.raw.once('aborted', abort);
    if (request.raw.aborted) abort();
    const send = (event: 'chunk' | 'final', data: unknown) => {
      if (!controller.signal.aborted) reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      // Authorize before committing the SSE response so normal concealment errors remain HTTP errors.
      await this.assistant.ensureAuthorized(user, params.id);
      reply.raw.writeHead(200, {
        'access-control-allow-origin': process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'content-type': 'text/event-stream; charset=utf-8',
        vary: 'Origin',
        'x-accel-buffering': 'no',
      });
      const interpretation = await this.assistant.interpret(user, params.id, input, controller.signal, (text) => send('chunk', { text }));
      send('final', interpretation);
    } finally {
      request.raw.removeListener('aborted', abort);
      reply.raw.end();
    }
  }
}
