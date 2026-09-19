export const VOICE_SAMPLE_RATE = 16_000;
export const VOICE_MAX_PCM_BYTES = 1_920_000;

export function resampleLinear(input: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === VOICE_SAMPLE_RATE) return input.slice();
  const length = Math.floor(input.length * VOICE_SAMPLE_RATE / sourceRate);
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = index * sourceRate / VOICE_SAMPLE_RATE;
    const left = Math.floor(position); const right = Math.min(left + 1, input.length - 1); const fraction = position - left;
    output[index] = (input[left] ?? 0) * (1 - fraction) + (input[right] ?? 0) * fraction;
  }
  return output;
}

export function pcm16Wav(samples: Float32Array): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2); const view = new DataView(bytes);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); write(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, VOICE_SAMPLE_RATE, true); view.setUint32(28, 32_000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 0x8000 : 0x7fff)), true));
  return new Blob([bytes], { type: 'audio/wav' });
}

const processor = `class VoiceCaptureProcessor extends AudioWorkletProcessor { process(inputs) { const channels = inputs[0]; if (!channels || channels.length === 0) return true; const output = new Float32Array(channels[0].length); for (let i = 0; i < output.length; i += 1) { let sum = 0; for (const channel of channels) sum += channel[i] || 0; output[i] = sum / channels.length; } this.port.postMessage(output, [output.buffer]); return true; } } registerProcessor('voice-capture', VoiceCaptureProcessor);`;

export class VoiceRecorder {
  private context: AudioContext | undefined; private stream: MediaStream | undefined; private source: MediaStreamAudioSourceNode | undefined; private node: AudioWorkletNode | undefined; private url: string | undefined; private chunks: Float32Array[] = [];
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext(); this.url = URL.createObjectURL(new Blob([processor], { type: 'text/javascript' }));
    await this.context.audioWorklet.addModule(this.url); this.source = this.context.createMediaStreamSource(this.stream); this.node = new AudioWorkletNode(this.context, 'voice-capture');
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => { this.chunks.push(event.data); };
    this.source.connect(this.node); this.node.connect(this.context.destination);
  }
  async stop(): Promise<Blob> {
    const context = this.context; const samples = resampleLinear(Float32Array.from(this.chunks.flatMap((chunk) => [...chunk])), context?.sampleRate ?? VOICE_SAMPLE_RATE);
    this.cleanup(); if (samples.byteLength > VOICE_MAX_PCM_BYTES) throw new Error('AUDIO_SIZE_EXCEEDED');
    return pcm16Wav(samples);
  }
  cancel(): void { this.cleanup(); }
  private cleanup(): void { this.node?.disconnect(); this.source?.disconnect(); this.stream?.getTracks().forEach((track) => track.stop()); void this.context?.close(); if (this.url) URL.revokeObjectURL(this.url); this.context = undefined; this.stream = undefined; this.source = undefined; this.node = undefined; this.url = undefined; this.chunks = []; }
}
