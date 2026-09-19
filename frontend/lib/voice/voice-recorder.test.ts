import { describe, expect, it } from 'vitest';
import { pcm16Wav, resampleLinear } from './voice-recorder';

describe('voice WAV construction', () => {
  it('linearly resamples and writes canonical PCM16 WAVE', () => {
    expect(resampleLinear(new Float32Array([0, 1]), 8_000)).toHaveLength(4);
    const wav = pcm16Wav(new Float32Array([0, 1, -1]));
    expect(wav.type).toBe('audio/wav');
    expect(wav.size).toBe(50);
  });
});
