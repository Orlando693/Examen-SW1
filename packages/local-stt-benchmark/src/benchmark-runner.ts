import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseCompletedWav, validateVoskModelPath, VoskSttProvider, type VoskInitialization } from '@examen-sw1/local-stt';
import { STT_BENCHMARK_DATASET, STT_BENCHMARK_MANIFEST, STT_BENCHMARK_DATASET_VERSION, validateSttBenchmarkDataset, type SttBenchmarkCase } from './benchmark-dataset.js';
import { aggregateCommandSuccess, calculateWer, runCommandPreview, type CommandPreviewResult, type WerResult } from './benchmark.js';

const MAX_RESULT_BYTES = 262_144;
const DIRECTORY_HASH_DOMAIN = 'examen-sw1-directory-sha256-v1\0';
export interface BenchmarkResult {
  datasetVersion: string; configuration: typeof STT_BENCHMARK_MANIFEST.runtime; model: { id: string; directory: string; archiveSha256: string | null; extractedDirectorySha256: string | null }; environment: { node: string; platform: string; arch: string; cpuModel: string | null; logicalCpus: number }; loadLatencyMs: number; resources: { before: { rssBytes: number; heapUsedBytes: number }; after: { rssBytes: number; heapUsedBytes: number }; vramBytes: null; vramStatus: 'notApplicable' }; cases: Array<{ caseId: string; audio: { relativePath: string; sha256: string | null; byteLength: number }; transcription: string; wer: WerResult; preview: CommandPreviewResult; latency: { totalMs: number; transcriptionMs: number } }>; aggregate: { wer: { errors: number; denominator: number; rate: number }; commandSuccess: ReturnType<typeof aggregateCommandSuccess>; totalLatencyMs: number; averageLatencyMs: number }; failures: Array<{ caseId: string; code: string }>; manualEdgeCaseObservations: null;
}
export interface DurableBenchmarkSummary { datasetVersion: string; model: Pick<BenchmarkResult['model'], 'id' | 'archiveSha256' | 'extractedDirectorySha256'>; environment: BenchmarkResult['environment']; loadLatencyMs: number; resources: BenchmarkResult['resources']; aggregate: BenchmarkResult['aggregate']; failures: BenchmarkResult['failures']; manualEdgeCaseObservations: null; }

function usage(): string { return 'Usage: VOSK_MODEL_PATH=<model-dir> STT_BENCHMARK_AUDIO_ROOT=<audio-dir> node dist/benchmark-runner.js [--case <id>] [--resume <file.json> | --output <file.json>] | --model-directory-sha256 <model-dir> | --verify-inputs'; }
export function parseRunnerArgs(args: string[]): { caseId?: string; output?: string; resume?: string; modelDirectorySha256?: string; verifyInputs?: true } {
  const result: { caseId?: string; output?: string; resume?: string; modelDirectorySha256?: string; verifyInputs?: true } = {};
  for (let index = 0; index < args.length;) { const flag = args[index]; if (flag === '--verify-inputs') { result.verifyInputs = true; index += 1; continue; } const value = args[index + 1]; if (!value || !['--case', '--output', '--resume', '--model-directory-sha256'].includes(flag)) throw new Error(usage()); if (flag === '--case') result.caseId = value; if (flag === '--output') result.output = value; if (flag === '--resume') result.resume = value; if (flag === '--model-directory-sha256') result.modelDirectorySha256 = value; index += 2; }
  if (result.verifyInputs && (result.caseId || result.output || result.resume || result.modelDirectorySha256)) throw new Error('--verify-inputs cannot be combined with another option.');
  if (result.output && result.resume) throw new Error('--output and --resume cannot be used together.'); return result;
}
function hashLength(length: number): Buffer { const value = Buffer.alloc(8); value.writeBigUInt64BE(BigInt(length)); return value; }
/** Hashes lexical POSIX relative paths and exact file bytes with length prefixes; timestamps and absolute paths are excluded. */
export async function calculateDirectorySha256(directory: string): Promise<string> {
  const root = resolve(directory); if (!(await stat(root)).isDirectory()) throw new Error('Model directory must exist and be a directory.');
  const files: string[] = [];
  async function collect(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true }); entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Model directory contains unsupported entry: ${relative(root, path)}`);
    }
  }
  await collect(root); files.sort((left, right) => { const leftPath = relative(root, left).split(sep).join('/'); const rightPath = relative(root, right).split(sep).join('/'); return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0; });
  const hash = createHash('sha256').update(DIRECTORY_HASH_DOMAIN, 'utf8');
  for (const file of files) { const path = relative(root, file).split(sep).join('/'); const pathBytes = Buffer.from(path, 'utf8'); const data = await readFile(file); hash.update(hashLength(pathBytes.byteLength)).update(pathBytes).update(hashLength(data.byteLength)).update(data); }
  return hash.digest('hex');
}
export function safeResultDirectory(sourceRoot = process.cwd()): string {
  const directory = resolve(process.env.STT_BENCHMARK_RESULTS_DIR ?? resolve(tmpdir(), 'examen-sw1-local-stt-benchmarks')); const fromSource = relative(resolve(sourceRoot), directory);
  if (fromSource === '' || (!fromSource.startsWith(`..${sep}`) && fromSource !== '..' && !isAbsolute(fromSource))) throw new Error('STT_BENCHMARK_RESULTS_DIR must be outside the source tree.');
  return directory;
}
export function safeResultPath(directory: string, fileName: string): string { if (basename(fileName) !== fileName || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.json$/.test(fileName)) throw new Error('Result files must be short JSON file names within the benchmark result directory.'); return resolve(directory, fileName); }
function safeAudioPath(root: string, item: SttBenchmarkCase): string { const path = resolve(root, item.audio.relativePath); const fromRoot = relative(root, path); if (fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) throw new Error(`Unsafe external audio reference: ${item.id}`); return path; }
async function readVerifiedAudio(root: string, item: SttBenchmarkCase): Promise<Uint8Array> {
  if (item.audio.sha256 === null || item.audio.byteLength === null) throw new Error(`Audio identity is not measured: ${item.id}`);
  const path = safeAudioPath(root, item); let data: Buffer;
  try { data = await readFile(path); } catch { throw new Error(`Missing external audio reference: ${item.id}`); }
  if (data.byteLength !== item.audio.byteLength) throw new Error(`Audio length mismatch: ${item.id}`);
  if (createHash('sha256').update(data).digest('hex') !== item.audio.sha256) throw new Error(`Audio checksum mismatch: ${item.id}`);
  parseCompletedWav(data); return data;
}
function assertResumeCompatible(previous: BenchmarkResult): void {
  if (previous.datasetVersion !== STT_BENCHMARK_DATASET_VERSION || JSON.stringify(previous.configuration) !== JSON.stringify(STT_BENCHMARK_MANIFEST.runtime) || previous.model.id !== STT_BENCHMARK_MANIFEST.modelPolicy.id) throw new Error('The resumed result is incompatible with the current dataset or runtime configuration.');
  const ids = new Set<string>(); for (const result of previous.cases) { if (!STT_BENCHMARK_DATASET.some((item) => item.id === result.caseId) || ids.has(result.caseId)) throw new Error('The resumed result has invalid or duplicate case IDs.'); ids.add(result.caseId); }
}
export function toDurableBenchmarkSummary(result: BenchmarkResult): DurableBenchmarkSummary { return { datasetVersion: result.datasetVersion, model: { id: result.model.id, archiveSha256: result.model.archiveSha256, extractedDirectorySha256: result.model.extractedDirectorySha256 }, environment: result.environment, loadLatencyMs: result.loadLatencyMs, resources: result.resources, aggregate: result.aggregate, failures: result.failures, manualEdgeCaseObservations: null }; }
export async function measureProviderInitialization(provider: { initialize(): Promise<VoskInitialization> }, now: () => number = () => performance.now()): Promise<{ initialization: VoskInitialization; loadLatencyMs: number }> {
  const started = now(); const initialization = await provider.initialize(); return { initialization, loadLatencyMs: now() - started };
}
async function verifyInputs(): Promise<{ modelPath: string; audioRoot: string }> {
  validateSttBenchmarkDataset();
  const modelPath = await validateVoskModelPath(process.env.VOSK_MODEL_PATH); if (!modelPath) throw new Error('VOSK_MODEL_PATH must point to the resolved local Spanish Vosk model.');
  if (STT_BENCHMARK_MANIFEST.modelPolicy.extractedDirectorySha256 === null) throw new Error('Extracted model directory integrity is not measured in the benchmark manifest.');
  if (await calculateDirectorySha256(modelPath) !== STT_BENCHMARK_MANIFEST.modelPolicy.extractedDirectorySha256) throw new Error('Extracted model directory checksum mismatch.');
  const audioRoot = process.env.STT_BENCHMARK_AUDIO_ROOT; if (!audioRoot || !(await stat(audioRoot)).isDirectory()) throw new Error('STT_BENCHMARK_AUDIO_ROOT must be an existing external audio directory.');
  for (const item of STT_BENCHMARK_DATASET) await readVerifiedAudio(resolve(audioRoot), item);
  return { modelPath, audioRoot };
}

async function main(): Promise<void> {
  const options = parseRunnerArgs(process.argv.slice(2));
  if (options.modelDirectorySha256) { console.log(await calculateDirectorySha256(options.modelDirectorySha256)); return; }
  const { modelPath, audioRoot } = await verifyInputs();
  if (options.verifyInputs) { console.log(JSON.stringify({ model: basename(modelPath), extractedDirectorySha256: STT_BENCHMARK_MANIFEST.modelPolicy.extractedDirectorySha256, cases: STT_BENCHMARK_DATASET.map((item) => item.id), provider: 'VoskSttProvider' })); return; }
  const selected = options.caseId ? STT_BENCHMARK_DATASET.filter((item) => item.id === options.caseId) : STT_BENCHMARK_DATASET; if (selected.length === 0) throw new Error(`Unknown benchmark case: ${options.caseId ?? ''}`);
  const directory = safeResultDirectory(); await mkdir(directory, { recursive: true }); const output = safeResultPath(directory, options.resume ?? options.output ?? `benchmark-${new Date().toISOString().replaceAll(':', '-')}.json`);
  const previous = options.resume ? JSON.parse(await readFile(output, 'utf8')) as BenchmarkResult : undefined; if (previous) assertResumeCompatible(previous);
  const resourcesBefore = process.memoryUsage(); const cpu = cpus(); const provider = new VoskSttProvider(modelPath); const measuredLoad = await measureProviderInitialization(provider); if (measuredLoad.initialization.status !== 'ready') throw new Error(measuredLoad.initialization.diagnostic.message); const completed = new Map(previous?.cases.map((item) => [item.caseId, item]) ?? []); const failures = [...(previous?.failures ?? [])]; const loadLatencyMs = measuredLoad.loadLatencyMs;
  for (const item of selected) if (!completed.has(item.id)) {
    const audio = await readVerifiedAudio(resolve(audioRoot), item); const verifiedIdentity = { relativePath: item.audio.relativePath, sha256: item.audio.sha256!, byteLength: item.audio.byteLength! }; const wav = parseCompletedWav(audio); const totalStarted = performance.now(); const transcriptionStarted = performance.now(); const result = await provider.transcribe({ frames: wav.frames }); const transcriptionMs = performance.now() - transcriptionStarted;
    if (result.status !== 'final') { failures.push({ caseId: item.id, code: result.diagnostic.code }); if (item.expected.diagnosticCode !== result.diagnostic.code) throw new Error(`Unexpected transcription diagnostic for ${item.id}: ${result.diagnostic.code}`); completed.set(item.id, { caseId: item.id, audio: verifiedIdentity, transcription: '', wer: calculateWer(item.referenceTranscript, ''), preview: runCommandPreview(item), latency: { totalMs: performance.now() - totalStarted, transcriptionMs } }); continue; }
    const wer = calculateWer(item.referenceTranscript, result.text); completed.set(item.id, { caseId: item.id, audio: verifiedIdentity, transcription: result.text, wer, preview: runCommandPreview(item, result.text), latency: { totalMs: performance.now() - totalStarted, transcriptionMs } });
  }
  const cases = STT_BENCHMARK_DATASET.filter((item) => completed.has(item.id)).map((item) => completed.get(item.id)!); const errors = cases.reduce((sum, item) => sum + item.wer.errors, 0); const denominator = cases.reduce((sum, item) => sum + item.wer.denominator, 0); const totalLatencyMs = cases.reduce((sum, item) => sum + item.latency.totalMs, 0); const resourcesAfter = process.memoryUsage();
  const persisted: BenchmarkResult = { datasetVersion: STT_BENCHMARK_DATASET_VERSION, configuration: STT_BENCHMARK_MANIFEST.runtime, model: { id: STT_BENCHMARK_MANIFEST.modelPolicy.id, directory: basename(modelPath), archiveSha256: STT_BENCHMARK_MANIFEST.modelPolicy.archiveSha256, extractedDirectorySha256: STT_BENCHMARK_MANIFEST.modelPolicy.extractedDirectorySha256 }, environment: { node: process.version, platform: process.platform, arch: process.arch, cpuModel: cpu[0]?.model ?? null, logicalCpus: cpu.length }, loadLatencyMs, resources: { before: { rssBytes: resourcesBefore.rss, heapUsedBytes: resourcesBefore.heapUsed }, after: { rssBytes: resourcesAfter.rss, heapUsedBytes: resourcesAfter.heapUsed }, vramBytes: null, vramStatus: 'notApplicable' }, cases, aggregate: { wer: { errors, denominator, rate: denominator === 0 ? 0 : errors / denominator }, commandSuccess: aggregateCommandSuccess(cases.map((item) => item.preview)), totalLatencyMs, averageLatencyMs: cases.length === 0 ? 0 : totalLatencyMs / cases.length }, failures, manualEdgeCaseObservations: null };
  const json = JSON.stringify(persisted, null, 2); if (Buffer.byteLength(json) > MAX_RESULT_BYTES) throw new Error(`Benchmark result exceeds the safe ${MAX_RESULT_BYTES / 1024} KiB limit.`); await writeFile(output, json, 'utf8'); console.log(JSON.stringify({ resultPath: output, summary: toDurableBenchmarkSummary(persisted) }));
}
if (process.argv[1]?.endsWith('benchmark-runner.js')) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Benchmark failed.'); process.exitCode = 1; });
