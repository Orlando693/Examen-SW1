import { Inject, Injectable } from '@nestjs/common';
import { parseCompletedWav, type LocalSttProvider, type SttResult } from '@examen-sw1/local-stt';

export const LOCAL_STT_PROVIDER = Symbol('LOCAL_STT_PROVIDER');

@Injectable()
export class VoiceService {
  constructor(@Inject(LOCAL_STT_PROVIDER) private readonly provider: LocalSttProvider) {}
  async transcribe(body: Uint8Array, signal?: AbortSignal): Promise<SttResult> {
    try {
      const audio = parseCompletedWav(body);
      if (signal?.aborted) return { status: 'cancelled', diagnostic: { code: 'REQUEST_CANCELLED', message: 'The transcription was cancelled.' } };
      const result = await this.provider.transcribe({ frames: audio.frames, signal });
      return signal?.aborted ? { status: 'cancelled', diagnostic: { code: 'REQUEST_CANCELLED', message: 'The transcription was cancelled.' } } : result;
    } catch (cause) {
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : 'AUDIO_FORMAT_INVALID';
      return { status: 'error', diagnostic: { code: code === 'AUDIO_SIZE_EXCEEDED' || code === 'AUDIO_DURATION_EXCEEDED' || code === 'AUDIO_UNSUPPORTED' ? code : 'AUDIO_FORMAT_INVALID', message: 'The completed WAV audio is invalid.' } };
    }
  }
}
