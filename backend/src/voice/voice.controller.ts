import { Body, Controller, Inject, Post, Req, UnsupportedMediaTypeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { SttResult } from '@examen-sw1/local-stt';
import { VoiceService } from './voice.service.js';

@Controller('assistant/voice')
export class VoiceController {
  constructor(@Inject(VoiceService) private readonly voice: VoiceService) {}
  @Post('transcriptions')
  async transcribe(@Body() body: Buffer, @Req() request: FastifyRequest): Promise<SttResult> {
    if (request.headers['content-type']?.split(';')[0]?.toLowerCase() !== 'audio/wav' || !Buffer.isBuffer(body)) throw new UnsupportedMediaTypeException();
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.raw.once('aborted', abort);
    if (request.raw.aborted) abort();
    try { return await this.voice.transcribe(body, controller.signal); } finally { request.raw.removeListener('aborted', abort); }
  }
}
