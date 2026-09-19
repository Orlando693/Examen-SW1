import { describe, expect, it, vi } from 'vitest';
import { DeterministicSttProvider, type LocalSttProvider } from '@examen-sw1/local-stt';
import { VoiceService } from './voice.service.js';

function wav(): Uint8Array { const bytes = new Uint8Array(44 + 32_000); const view = new DataView(bytes.buffer); bytes.set(new TextEncoder().encode('RIFF'), 0); view.setUint32(4, bytes.byteLength - 8, true); bytes.set(new TextEncoder().encode('WAVEfmt '), 8); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16_000, true); view.setUint32(28, 32_000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); bytes.set(new TextEncoder().encode('data'), 36); view.setUint32(40, 32_000, true); return bytes; }
describe('VoiceService', () => {
  it('validates WAV before invoking its provider and never imports UML services', async () => { const provider = { transcribe: vi.fn().mockResolvedValue({ status: 'final', text: 'crear Cliente' }) } as unknown as LocalSttProvider; await expect(new VoiceService(provider).transcribe(wav())).resolves.toEqual({ status: 'final', text: 'crear Cliente' }); expect(provider.transcribe).toHaveBeenCalledOnce(); });
  it('does not invoke recognition for malformed audio', async () => { const provider = { transcribe: vi.fn() } as unknown as LocalSttProvider; await expect(new VoiceService(provider).transcribe(new Uint8Array())).resolves.toMatchObject({ status: 'error', diagnostic: { code: 'AUDIO_FORMAT_INVALID' } }); expect(provider.transcribe).not.toHaveBeenCalled(); });
  it('discards a cancelled request', async () => { const controller = new AbortController(); controller.abort(); await expect(new VoiceService(new DeterministicSttProvider()).transcribe(wav(), controller.signal)).resolves.toMatchObject({ status: 'cancelled' }); });
});
