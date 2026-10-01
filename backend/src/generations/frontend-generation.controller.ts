import { Controller, Inject, Param, Post, Res, ValidationPipe } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import type { FastifyReply } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectIdParamsDto } from '../projects/projects.dto.js';
import { FrontendGenerationService } from './frontend-generation.service.js';

const projectIdPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: ProjectIdParamsDto });

@Controller('projects/:id/generations')
export class FrontendGenerationController {
  constructor(@Inject(FrontendGenerationService) private readonly generations: FrontendGenerationService) {}

  @Post('frontend')
  async generate(@CurrentUser() user: SafeUser, @Param(projectIdPipe) params: ProjectIdParamsDto, @Res() reply: FastifyReply): Promise<void> {
    const download = await this.generations.generate(user, params.id);
    const stream = createReadStream(download.zipPath);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      void this.generations.cleanup(download).catch(() => undefined);
    };
    reply.raw.once('finish', cleanup);
    reply.raw.once('close', cleanup);
    stream.once('error', cleanup);
    try {
      reply.code(200).type('application/zip').header('Content-Disposition', `attachment; filename="${download.filename}"`).header('Cache-Control', 'no-store').send(stream);
    } catch (error) {
      stream.destroy();
      cleanup();
      throw error;
    }
  }
}
