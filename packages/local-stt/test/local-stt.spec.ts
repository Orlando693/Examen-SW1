import { describe, expect, it } from 'vitest';
import { DeterministicSttProvider, parseCompletedWav, WAV_HTTP_PAYLOAD_BYTES } from '../src/index.js';

function wav(options: { metadata?: boolean; tag?: number; channels?: number; sampleRate?: number; bits?: number; align?: number; byteRate?: number; dataBytes?: number; riffSize?: number } = {}): Uint8Array {
  const dataBytes = options.dataBytes ?? 32_000;
  const meta = options.metadata ? 12 : 0;
  const total = 12 + 24 + meta + 8 + dataBytes;
  const bytes = new Uint8Array(total); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RIFF'), 0); view.setUint32(4, options.riffSize ?? total - 8, true); bytes.set(new TextEncoder().encode('WAVEfmt '), 8); view.setUint32(16, 16, true);
  view.setUint16(20, options.tag ?? 1, true); view.setUint16(22, options.channels ?? 1, true); view.setUint32(24, options.sampleRate ?? 16_000, true); view.setUint32(28, options.byteRate ?? 32_000, true); view.setUint16(32, options.align ?? 2, true); view.setUint16(34, options.bits ?? 16, true);
  let at = 36; if (options.metadata) { bytes.set(new TextEncoder().encode('JUNK'), at); view.setUint32(at + 4, 3, true); at += 12; }
  bytes.set(new TextEncoder().encode('data'), at); view.setUint32(at + 4, dataBytes, true); return bytes;
}
describe('completed WAV contract', () => {
  it('accepts canonical PCM WAV', () => expect(parseCompletedWav(wav()).frames).toHaveLength(32_000));
  it('accepts metadata before data', () => expect(parseCompletedWav(wav({ metadata: true })).durationSeconds).toBe(1));
  it('rejects malformed chunk structure', () => expect(() => parseCompletedWav(wav().slice(0, -1))).toThrow());
  it('rejects non-PCM format', () => expect(() => parseCompletedWav(wav({ tag: 3 }))).toThrow());
  it('rejects non-mono audio', () => expect(() => parseCompletedWav(wav({ channels: 2 }))).toThrow());
  it('rejects unsupported PCM fields', () => expect(() => parseCompletedWav(wav({ sampleRate: 8_000 }))).toThrow());
  it('rejects declared mismatch, PCM-size, and duration excess', () => { expect(() => parseCompletedWav(wav({ riffSize: 1 }))).toThrow(); expect(() => parseCompletedWav(wav({ dataBytes: 1_920_002 }))).toThrow(); });
  it('enforces the independent HTTP payload limit', () => expect(() => parseCompletedWav(wav(), WAV_HTTP_PAYLOAD_BYTES + 1)).toThrow());
});
describe('deterministic provider', () => it('cancels without a Vosk runtime or model', async () => { const controller = new AbortController(); controller.abort(); await expect(new DeterministicSttProvider().transcribe({ frames: new Uint8Array(), signal: controller.signal })).resolves.toMatchObject({ status: 'cancelled' }); }));
