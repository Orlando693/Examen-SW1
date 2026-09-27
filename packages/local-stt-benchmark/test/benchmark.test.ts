import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STT_BENCHMARK_DATASET, STT_BENCHMARK_DATASET_VERSION, validateSttBenchmarkDataset } from '../src/benchmark-dataset.js';
import { aggregateCommandSuccess, calculateWer, normalizeSttTranscript, runCommandPreview } from '../src/benchmark.js';
import { calculateDirectorySha256, measureProviderInitialization, parseRunnerArgs, safeResultDirectory, safeResultPath, toDurableBenchmarkSummary } from '../src/benchmark-runner.js';
import { parseCompletedWav } from '@examen-sw1/local-stt';

describe('synthetic STT benchmark', () => {
  it('has a versioned complete descriptor without audio assets', () => { validateSttBenchmarkDataset(); expect(STT_BENCHMARK_DATASET_VERSION).toMatch(/^stt-spanish-case-v1-/); expect(STT_BENCHMARK_DATASET.map((item) => item.expected.outcome)).toEqual(expect.arrayContaining(['preview', 'clarification', 'rejected'])); expect(STT_BENCHMARK_DATASET.map((item) => item.category)).toEqual(expect.arrayContaining(['clean-voice', 'moderate-noise', 'pause', 'uml-name', 'short-command', 'long-command'])); expect(() => validateSttBenchmarkDataset([...STT_BENCHMARK_DATASET, STT_BENCHMARK_DATASET[0]])).toThrow('duplicate'); });
  it('normalizes only declared differences and counts WER operations', () => {
    expect(normalizeSttTranscript('  CLASE: Ágil_2!  ')).toBe('clase ágil_2');
    expect(calculateWer('uno dos tres', 'uno cuatro tres extra')).toMatchObject({ substitutions: 1, insertions: 1, deletions: 0, errors: 2, denominator: 3 });
    expect(calculateWer('Crea, Cliente.', ' crea cliente ')).toMatchObject({ wer: 0, errors: 0 });
    expect(calculateWer('uno dos', 'uno')).toMatchObject({ deletions: 1 });
    expect(calculateWer('', 'extra')).toMatchObject({ insertions: 1, denominator: 0, wer: 1 });
  });
  it('evaluates deterministic previews without mutation or a Qwen provider', () => { const results = STT_BENCHMARK_DATASET.map((item) => runCommandPreview(item)); expect(results.every((item) => item.successful && item.documentUnchanged)).toBe(true); expect(runCommandPreview(STT_BENCHMARK_DATASET[0], 'crea la clase proveedor')).toMatchObject({ successful: false, diagnosticCodes: ['TRANSCRIPT_MISMATCH'] }); expect(results.find((item) => item.caseId === 'failed-transcript')).toMatchObject({ diagnosticCodes: ['TRANSCRIPTION_EMPTY'] }); expect(aggregateCommandSuccess(results)).toMatchObject({ denominator: 7, passed: 7, rate: 1 }); });
  it('keeps runner paths and persisted summaries bounded and sanitized', () => {
    expect(parseRunnerArgs(['--case', 'create-cliente'])).toEqual({ caseId: 'create-cliente' }); expect(parseRunnerArgs(['--model-directory-sha256', 'C:/model'])).toEqual({ modelDirectorySha256: 'C:/model' }); expect(parseRunnerArgs(['--verify-inputs'])).toEqual({ verifyInputs: true }); expect(() => parseRunnerArgs(['--verify-inputs', '--case', 'create-cliente'])).toThrow(); expect(() => parseRunnerArgs(['--case'])).toThrow(); expect(() => safeResultPath('C:/temp', '../bad.json')).toThrow(); expect(() => safeResultDirectory('C:/workspace')).not.toThrow();
    const summary = toDurableBenchmarkSummary({ datasetVersion: STT_BENCHMARK_DATASET_VERSION, configuration: { sampleRate: 16_000, channels: 1, encoding: 'PCM16LE', concurrency: 1, remoteInference: false }, model: { id: 'vosk-model-small-es-0.42', directory: 'secret-path', archiveSha256: null, extractedDirectorySha256: null }, environment: { node: 'v24', platform: 'win32', arch: 'x64', cpuModel: null, logicalCpus: 1 }, loadLatencyMs: 0, resources: { before: { rssBytes: 0, heapUsedBytes: 0 }, after: { rssBytes: 0, heapUsedBytes: 0 }, vramBytes: null, vramStatus: 'notApplicable' }, cases: [], aggregate: { wer: { errors: 0, denominator: 0, rate: 0 }, commandSuccess: { denominator: 0, passed: 0, rate: 0 }, totalLatencyMs: 0, averageLatencyMs: 0 }, failures: [], manualEdgeCaseObservations: null }); expect(JSON.stringify(summary)).not.toContain('secret-path');
  });
  it('does not require Vosk or audio assets and rejects malformed WAV input before transcription', () => { expect(() => parseCompletedWav(new Uint8Array([1, 2, 3]))).toThrow(); });
  it('measures only provider initialization and never invokes transcription', async () => {
    const initialize = async () => ({ status: 'ready' as const }); const transcribe = () => { throw new Error('must not transcribe while measuring load'); }; const provider = { initialize, transcribe };
    await expect(measureProviderInitialization(provider, (() => { const times = [10, 35]; return () => times.shift()!; })())).resolves.toMatchObject({ initialization: { status: 'ready' }, loadLatencyMs: 25 });
  });
  it('hashes model directories from lexical relative paths and exact file bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stt-directory-hash-')); const reordered = await mkdtemp(join(tmpdir(), 'stt-directory-hash-')); const renamed = await mkdtemp(join(tmpdir(), 'stt-directory-hash-'));
    try {
      await mkdir(join(root, 'nested')); await writeFile(join(root, 'nested', 'b.bin'), 'second'); await writeFile(join(root, 'a.bin'), 'first');
      await mkdir(join(reordered, 'nested')); await writeFile(join(reordered, 'a.bin'), 'first'); await writeFile(join(reordered, 'nested', 'b.bin'), 'second');
      await mkdir(join(renamed, 'nested')); await writeFile(join(renamed, 'nested', 'different-name.bin'), 'second'); await writeFile(join(renamed, 'a.bin'), 'first');
      await expect(calculateDirectorySha256(root)).resolves.toMatch(/^[a-f0-9]{64}$/); await expect(calculateDirectorySha256(root)).resolves.toBe(await calculateDirectorySha256(reordered)); await expect(calculateDirectorySha256(root)).resolves.not.toBe(await calculateDirectorySha256(renamed));
    } finally { await Promise.all([root, reordered, renamed].map((path) => rm(path, { recursive: true, force: true }))); }
  });
});
