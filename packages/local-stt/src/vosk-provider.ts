import { access, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';
import type { LocalSttProvider, SttResult } from './index.js';

const require = createRequire(import.meta.url);
const unavailable = (message: string): SttResult => ({ status: 'unavailable', diagnostic: { code: 'MODEL_UNAVAILABLE', message } });

export function extractVoskTranscript(result: unknown): string | undefined {
  const value = typeof result === 'string' ? JSON.parse(result) : result;
  return typeof value === 'object' && value !== null && typeof (value as { text?: unknown }).text === 'string'
    ? (value as { text: string }).text.trim()
    : undefined;
}

export async function validateVoskModelPath(modelPath: string | undefined): Promise<string | undefined> {
  if (!modelPath) return undefined;
  const path = resolve(modelPath);
  if (basename(path) !== 'vosk-model-small-es-0.42') return undefined;
  try {
    if (!(await stat(path)).isDirectory()) return undefined;
    // These are stable structural assets in the selected Vosk Spanish model layout.
    await Promise.all(['am/final.mdl', 'conf/model.conf', 'graph/HCLr.fst', 'graph/Gr.fst', 'graph/phones/word_boundary.int'].map((file) => access(join(path, file))));
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
      const vosk = require('vosk') as { Model: new (path: string) => unknown; Recognizer: new (input: { model: unknown; sampleRate: number }) => { acceptWaveform(data: Buffer): boolean; finalResult(): unknown; free?(): void } };
      this.model ??= new vosk.Model(path);
      const recognizer = new vosk.Recognizer({ model: this.model, sampleRate: 16_000 });
      try {
        recognizer.acceptWaveform(Buffer.from(input.frames));
        if (input.signal?.aborted) return { status: 'cancelled', diagnostic: { code: 'REQUEST_CANCELLED', message: 'The transcription was cancelled.' } };
        const text = extractVoskTranscript(recognizer.finalResult());
        return text ? { status: 'final', text } : { status: 'error', diagnostic: { code: 'TRANSCRIPTION_EMPTY', message: 'No speech was recognized.' } };
      } finally { recognizer.free?.(); }
    } catch { return unavailable('The local speech runtime could not be initialized.'); }
  }
}
