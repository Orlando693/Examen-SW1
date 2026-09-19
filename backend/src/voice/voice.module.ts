import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller.js';
import { createVoiceProvider } from './voice.provider.js';
import { LOCAL_STT_PROVIDER, VoiceService } from './voice.service.js';

@Module({ controllers: [VoiceController], providers: [VoiceService, { provide: LOCAL_STT_PROVIDER, useFactory: createVoiceProvider }] })
export class VoiceModule {}
