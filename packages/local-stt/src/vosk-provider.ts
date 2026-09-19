import { access, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';
import type { LocalSttProvider, SttResult } from './index.js';

const require = createRequire(import.meta.url);
const unavailable = (message: string): SttResult => ({ status: 'unavailable', diagnostic: { code: 'MODEL_UNAVAILABLE', message } });

export async function validateVoskModelPath(modelPath: string | undefined): Promise<string | undefined> {
  if (!modelPath) return undefined;
  const path = resolve(modelPath);
  if (basename(path) !== 'vosk-model-small-es-0.42') return undefined;
  try {
    if (!(await stat(path)).isDirectory()) return undefined;
    await Promise.all(['am/final.mdl', 'conf/model.conf', 'graph/phones.txt'].map((file) => access(join(path, file))));
    return path;
  } catch { return undefined; }
}

export class VoskSttProvider implements LocalSttProvider {
  private model: unknown | undefined;
  constructor(private readonly modelPath: string | undefined) {}
  async transcribe(input: { frames: Uint8Array; signal?: AbortSignal }): Promise<SttResult> {
    if (input.signal?.aborted) return { status: 'cancelled', diagnostic: { code: 'REQUEST_CANCELLED', message: 'The transcription was cancelled.' } };
    const path = await validateVoskModelPath(this.modelPath);
    if (!path) return unavailable('The configured local Spanish model is unavailable.');
    try {
      const vosk = require('vosk') as { Model: new (path: string) => unknown; Recognizer: new (input: { model: unknown; sampleRate: number }) => { acceptWaveform(data: Buffer): boolean; finalResult(): string; free?(): void } };
      this.model ??= new vosk.Model(path);
      const recognizer = new vosk.Recognizer({ model: this.model, sampleRate: 16_000 });
      try {
        recognizer.acceptWaveform(Buffer.from(input.frames));
        if (input.signal?.aborted) return { status: 'cancelled', diagnostic: { code: 'REQUEST_CANCELLED', message: 'The transcription was cancelled.' } };
        const text = (JSON.parse(recognizer.finalResult()) as { text?: unknown }).text;
        return typeof text === 'string' && text.trim() ? { status: 'final', text: text.trim() } : { status: 'error', diagnostic: { code: 'TRANSCRIPTION_EMPTY', message: 'No speech was recognized.' } };
      } finally { recognizer.free?.(); }
    } catch { return unavailable('The local speech runtime could not be initialized.'); }
  }
}
