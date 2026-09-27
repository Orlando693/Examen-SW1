export const STT_DIAGNOSTIC_CODES = ['MICROPHONE_DENIED', 'MICROPHONE_UNAVAILABLE', 'AUDIO_DURATION_EXCEEDED', 'AUDIO_SIZE_EXCEEDED', 'AUDIO_FORMAT_INVALID', 'AUDIO_UNSUPPORTED', 'MODEL_UNAVAILABLE', 'TRANSCRIPTION_EMPTY', 'TRANSCRIPTION_FAILED', 'REQUEST_CANCELLED'] as const;
export type SttDiagnosticCode = typeof STT_DIAGNOSTIC_CODES[number];
export type SttDiagnostic = { code: SttDiagnosticCode; message: string };
export type SttResult = { status: 'final'; text: string } | { status: 'unavailable' | 'error' | 'cancelled'; diagnostic: SttDiagnostic };
export type ValidWav = { frames: Uint8Array; durationSeconds: number };

export const WAV_HTTP_PAYLOAD_BYTES = 2_097_152;
export const WAV_PCM_BYTES = 1_920_000;
export const WAV_SAMPLE_RATE = 16_000;
export { VoskSttProvider, extractVoskTranscript, validateVoskModelPath, type VoskInitialization } from './vosk-provider.js';

const fail = (code: SttDiagnosticCode, message: string): never => { throw Object.assign(new Error(message), { code }); };
const ascii = (data: Uint8Array, offset: number) => String.fromCharCode(...data.subarray(offset, offset + 4));

export function parseCompletedWav(data: Uint8Array, httpBytes = data.byteLength): ValidWav {
  if (httpBytes > WAV_HTTP_PAYLOAD_BYTES) fail('AUDIO_SIZE_EXCEEDED', 'The audio upload exceeds the allowed transport size.');
  if (data.byteLength < 12 || ascii(data, 0) !== 'RIFF' || ascii(data, 8) !== 'WAVE') fail('AUDIO_FORMAT_INVALID', 'The audio is not a valid RIFF/WAVE file.');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(4, true) !== data.byteLength - 8) fail('AUDIO_FORMAT_INVALID', 'The RIFF length does not match the upload.');
  let offset = 12;
  let format: { tag: number; channels: number; sampleRate: number; byteRate: number; align: number; bits: number } | undefined;
  let frames: Uint8Array | undefined;
  while (offset < data.byteLength) {
    if (offset + 8 > data.byteLength) fail('AUDIO_FORMAT_INVALID', 'The WAV chunk header is incomplete.');
    const id = ascii(data, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    const paddedEnd = end + (size % 2);
    if (end > data.byteLength || paddedEnd > data.byteLength) fail('AUDIO_FORMAT_INVALID', 'The WAV chunk exceeds the upload bounds.');
    if (id === 'fmt ') {
      if (format !== undefined || size < 16) fail('AUDIO_FORMAT_INVALID', 'The WAV format chunk is invalid.');
      format = { tag: view.getUint16(start, true), channels: view.getUint16(start + 2, true), sampleRate: view.getUint32(start + 4, true), byteRate: view.getUint32(start + 8, true), align: view.getUint16(start + 12, true), bits: view.getUint16(start + 14, true) };
    } else if (id === 'data') {
      if (frames !== undefined) fail('AUDIO_FORMAT_INVALID', 'The WAV file has multiple audio chunks.');
      frames = data.slice(start, end);
    }
    offset = paddedEnd;
  }
  if (offset !== data.byteLength || format === undefined || frames === undefined) throw Object.assign(new Error('The WAV file is missing required audio data.'), { code: 'AUDIO_FORMAT_INVALID' as const });
  const pcmFormat = format;
  const pcmFrames = frames;
  if (pcmFormat.tag !== 1 || pcmFormat.bits !== 16) fail('AUDIO_UNSUPPORTED', 'Only PCM16 WAV audio is supported.');
  if (pcmFormat.channels !== 1 || pcmFormat.sampleRate !== WAV_SAMPLE_RATE || pcmFormat.align !== 2 || pcmFormat.byteRate !== 32_000) fail('AUDIO_UNSUPPORTED', 'Audio must be mono PCM16LE at 16 kHz.');
  if (pcmFrames.byteLength % pcmFormat.align !== 0) fail('AUDIO_FORMAT_INVALID', 'The PCM payload is not frame aligned.');
  if (pcmFrames.byteLength > WAV_PCM_BYTES) fail('AUDIO_SIZE_EXCEEDED', 'The recording exceeds the allowed PCM size.');
  const durationSeconds = pcmFrames.byteLength / pcmFormat.byteRate;
  if (durationSeconds > 60) fail('AUDIO_DURATION_EXCEEDED', 'The recording exceeds 60 seconds.');
  return { frames: pcmFrames, durationSeconds };
}

export interface LocalSttProvider { transcribe(input: { frames: Uint8Array; signal?: AbortSignal }): Promise<SttResult>; }

export class DeterministicSttProvider implements LocalSttProvider {
  constructor(private readonly result: SttResult = { status: 'final', text: 'crear clase Cliente' }) {}
  async transcribe(input: { frames: Uint8Array; signal?: AbortSignal }): Promise<SttResult> {
    if (input.signal?.aborted) return { status: 'cancelled', diagnostic: { code: 'REQUEST_CANCELLED', message: 'The transcription was cancelled.' } };
    return this.result;
  }
}
