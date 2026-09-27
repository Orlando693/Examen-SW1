import type { AssistantCommand, AssistantModelContext } from '@examen-sw1/assistant-core';

export const STT_BENCHMARK_DATASET_VERSION = 'stt-spanish-case-v1-2026-09-20' as const;
export const STT_NORMALIZATION_RULES = 'lowercase Spanish casing; trim and collapse whitespace; strip Unicode punctuation; preserve accents, digits, and UML identifiers otherwise' as const;

export interface SttBenchmarkCase {
  id: string;
  category: 'clean-voice' | 'moderate-noise' | 'pause' | 'uml-name' | 'short-command' | 'long-command' | 'failure';
  classification: 'manual-external';
  audio: { relativePath: string; sha256: string | null; byteLength: number | null };
  referenceTranscript: string;
  expectedNormalizedTranscript: string;
  context: AssistantModelContext;
  expected: { outcome: 'preview' | 'clarification' | 'rejected'; candidate?: AssistantCommand; diagnosticCode?: string; destructive?: boolean };
}

export const STT_BENCHMARK_MANIFEST = {
  version: STT_BENCHMARK_DATASET_VERSION,
  language: 'es',
  normalization: STT_NORMALIZATION_RULES,
  modelPolicy: {
    id: 'vosk-model-small-es-0.42', source: 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip', license: 'Apache-2.0',
    archiveSha256: null, extractedDirectorySha256: '02711944638bebebe29e89b73ae75840dc403a9716a81e4f72d7e2840976ed96', configurationPath: 'VOSK_MODEL_PATH', expectedDirectory: 'vosk-model-small-es-0.42', binding: 'vosk@0.3.39', node: '>=24', os: 'win32 x64',
  },
  runtime: { sampleRate: 16_000, channels: 1, encoding: 'PCM16LE', concurrency: 1, remoteInference: false },
} as const;

const context: AssistantModelContext = {
  projectId: 'stt-benchmark-project', revision: 3,
  classes: [{ id: 'class-cliente', name: 'Cliente', attributes: [] }, { id: 'class-pedido', name: 'Pedido', attributes: [] }],
  enumerations: [], relationships: [],
};
const duplicateContext: AssistantModelContext = { ...context, classes: [...context.classes, { id: 'class-cliente-duplicate', name: 'Cliente', attributes: [] }] };
/** Descriptors identify externally supplied audio only. No audio is stored in this package. */
export const STT_BENCHMARK_DATASET: ReadonlyArray<SttBenchmarkCase> = [
  { id: 'clean-create-pedido', category: 'clean-voice', classification: 'manual-external', audio: { relativePath: 'clean-create-pedido.wav', byteLength: 191438, sha256: '51529185199ecd1baf563d14d69f06e2a0ee61050db2eb4cb0f8d7d1eafc62a9' }, referenceTranscript: 'Crea la clase Pedido.', expectedNormalizedTranscript: 'crea la clase pedido', context, expected: { outcome: 'preview', candidate: { version: 1, operation: 'create_class', name: 'Pedido' }, destructive: false } },
  { id: 'noise-create-cliente', category: 'moderate-noise', classification: 'manual-external', audio: { relativePath: 'noise-create-cliente.wav', byteLength: 191470, sha256: '5e1255399f0f50ab7211330c063f1c2e0b14d1a3dbd849aac5aa00f1bf7b4971' }, referenceTranscript: 'Crea la clase Cliente.', expectedNormalizedTranscript: 'crea la clase cliente', context, expected: { outcome: 'preview', candidate: { version: 1, operation: 'create_class', name: 'Cliente' }, destructive: false } },
  { id: 'create-cliente', category: 'uml-name', classification: 'manual-external', audio: { relativePath: 'create-cliente.wav', byteLength: 191470, sha256: 'd074d4816174584627d5ce5a68d54b28c70c7b1697bb29273df45722c16c9d85' }, referenceTranscript: 'Crea la clase Cliente.', expectedNormalizedTranscript: 'crea la clase cliente', context, expected: { outcome: 'preview', candidate: { version: 1, operation: 'create_class', name: 'Cliente' }, destructive: false } },
  { id: 'delete-pedido', category: 'short-command', classification: 'manual-external', audio: { relativePath: 'delete-pedido.wav', byteLength: 191662, sha256: '9d1fea836d238f4ae1edfbf1d1a273b3e06bb6f380b879ac4c7bc3f020caab70' }, referenceTranscript: 'Elimina la clase Pedido.', expectedNormalizedTranscript: 'elimina la clase pedido', context, expected: { outcome: 'preview', candidate: { version: 1, operation: 'delete_class', class: { id: 'class-pedido' } }, destructive: true } },
  { id: 'ambiguous-cliente', category: 'pause', classification: 'manual-external', audio: { relativePath: 'ambiguous-cliente.wav', byteLength: 223598, sha256: '839adbcf3a63d03433f5d1a0bd5d6bd560fb3a7f17caf6d6f6e75589ef5af106' }, referenceTranscript: 'Elimina Cliente.', expectedNormalizedTranscript: 'elimina cliente', context: duplicateContext, expected: { outcome: 'clarification', candidate: { version: 1, operation: 'delete_class', class: { name: 'Cliente' } }, diagnosticCode: 'AMBIGUOUS_REFERENCE' } },
  { id: 'missing-clase', category: 'long-command', classification: 'manual-external', audio: { relativePath: 'missing-clase.wav', byteLength: 223534, sha256: '52015613dc028a577f0ba45d62f0d318b90ea404fe5eef2c34495d31abc02c98' }, referenceTranscript: 'Renombra Ausente a Activa.', expectedNormalizedTranscript: 'renombra ausente a activa', context, expected: { outcome: 'rejected', candidate: { version: 1, operation: 'rename_class', class: { name: 'Ausente' }, name: 'Activa' }, diagnosticCode: 'UNRESOLVED_REFERENCE' } },
  { id: 'failed-transcript', category: 'failure', classification: 'manual-external', audio: { relativePath: 'failed-transcript.wav', byteLength: 127662, sha256: '2cbe1409cf7b221df2c15f7dda5306324f1936176a77babe2d6e519fd3440fe8' }, referenceTranscript: 'Texto no reconocido.', expectedNormalizedTranscript: 'texto no reconocido', context, expected: { outcome: 'rejected', diagnosticCode: 'TRANSCRIPTION_EMPTY' } },
];

export function validateSttBenchmarkDataset(dataset: ReadonlyArray<SttBenchmarkCase> = STT_BENCHMARK_DATASET): void {
  const ids = new Set<string>(); const paths = new Set<string>();
  if (dataset.length === 0) throw new Error('The STT benchmark dataset must not be empty.');
  for (const item of dataset) {
    if (!/^[a-z0-9-]{1,64}$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate benchmark case ID: ${item.id}`);
    if (!/^[a-z0-9][a-z0-9-]*\.wav$/.test(item.audio.relativePath) || paths.has(item.audio.relativePath)) throw new Error(`Invalid or duplicate external audio reference: ${item.audio.relativePath}`);
    if ((item.audio.sha256 !== null && !/^[a-f0-9]{64}$/.test(item.audio.sha256)) || (item.audio.byteLength !== null && (!Number.isSafeInteger(item.audio.byteLength) || item.audio.byteLength < 1))) throw new Error(`Invalid audio identity for benchmark case: ${item.id}`);
    if (!item.referenceTranscript || !item.expectedNormalizedTranscript || !item.context.projectId || item.classification !== 'manual-external') throw new Error(`Incomplete benchmark descriptor: ${item.id}`);
    if (item.expected.outcome === 'rejected' ? item.expected.diagnosticCode === undefined : item.expected.candidate === undefined) throw new Error(`Incomplete expected preview outcome: ${item.id}`);
    ids.add(item.id); paths.add(item.audio.relativePath);
  }
}
