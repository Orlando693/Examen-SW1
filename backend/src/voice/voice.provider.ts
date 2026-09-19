import { DeterministicSttProvider, VoskSttProvider, type LocalSttProvider } from '@examen-sw1/local-stt';

export function createVoiceProvider(environment = process.env): LocalSttProvider {
  if (environment.STT_PROVIDER === 'deterministic') {
    if (environment.NODE_ENV !== 'test') throw new Error('STT_PROVIDER=deterministic is allowed only when NODE_ENV=test.');
    return new DeterministicSttProvider();
  }
  if (environment.STT_PROVIDER !== undefined && environment.STT_PROVIDER !== '' && environment.STT_PROVIDER !== 'local') throw new Error('STT_PROVIDER must be local or deterministic.');
  return new VoskSttProvider(environment.VOSK_MODEL_PATH);
}
