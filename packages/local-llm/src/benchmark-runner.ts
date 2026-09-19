import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { cpus, tmpdir } from 'node:os';
import { ASSISTANT_BENCHMARK_DATASET, ASSISTANT_BENCHMARK_DATASET_VERSION } from './benchmark-dataset.js';
import { aggregateBenchmarkResults, runBenchmarkCase, type BenchmarkCaseResult } from './benchmark.js';
import { LOCAL_LLM_CONTEXT_SAFETY_MARGIN_TOKENS, LOCAL_LLM_GENERATION_OPTIONS, LocalLlmAssistantProvider, NodeLlamaRuntime, buildAssistantPrompt, selectLocalLlmContextSize } from './index.js';

interface PersistedResult { datasetVersion: string; model: { id: 'Qwen3-1.7B-Q4_K_M'; source: 'ggml-org/Qwen3-1.7B-GGUF'; fileName: string; fileSizeBytes: number; sha256: 'd2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5'; timeoutMs: number; contextBudgetChars: number; contextSize: number; failedCreationRemedy: false; concurrency: 1; generation: typeof LOCAL_LLM_GENERATION_OPTIONS; }; environment: { node: string; platform: string; arch: string; cpuModel: string | null; logicalCpus: number; }; loadMs: number; resources: { rssBytesBefore: number; rssBytesAfter: number; heapUsedBytesBefore: number; heapUsedBytesAfter: number; vramBytes: null; }; manualObservation: null; results: BenchmarkCaseResult[]; aggregate: ReturnType<typeof aggregateBenchmarkResults>; }

function usage(): string { return 'Usage: LOCAL_LLM_MODEL_PATH=<model.gguf> node dist/benchmark-runner.js [--measure-token-capacity | --case <id>] [--resume <file.json> | --output <file.json>]'; }
function resultDirectory(): string {
  const directory = resolve(process.env.LOCAL_LLM_BENCHMARK_RESULTS_DIR ?? resolve(tmpdir(), 'examen-sw1-local-llm-benchmarks'));
  if (!relative(process.cwd(), directory).startsWith('..') && !isAbsolute(relative(process.cwd(), directory))) throw new Error('LOCAL_LLM_BENCHMARK_RESULTS_DIR must be outside the current source directory.');
  return directory;
}
function resultPath(directory: string, fileName: string): string {
  if (basename(fileName) !== fileName || !fileName.endsWith('.json') || fileName.length > 128) throw new Error('Result files must be short JSON file names within the benchmark results directory.');
  return resolve(directory, fileName);
}
function parseArgs(args: string[]): { caseId?: string; output?: string; resume?: string; measureTokenCapacity: boolean } {
  const result: { caseId?: string; output?: string; resume?: string; measureTokenCapacity: boolean } = { measureTokenCapacity: false };
  if (args.length === 1 && args[0] === '--measure-token-capacity') return { ...result, measureTokenCapacity: true };
  for (let index = 0; index < args.length; index += 2) {
    const value = args[index + 1];
    if (!value || !['--case', '--output', '--resume'].includes(args[index])) throw new Error(usage());
    if (args[index] === '--case') result.caseId = value;
    if (args[index] === '--output') result.output = value;
    if (args[index] === '--resume') result.resume = value;
  }
  if (result.output && result.resume) throw new Error('--output and --resume cannot be used together.');
  return result;
}
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const modelPath = process.env.LOCAL_LLM_MODEL_PATH;
  if (!modelPath) throw new Error('LOCAL_LLM_MODEL_PATH is required.');
  if (options.measureTokenCapacity) {
    const { getLlama } = await import('node-llama-cpp');
    const llama = await getLlama({ build: 'never' });
    const model = await llama.loadModel({ modelPath, vocabOnly: true });
    try {
      const fixtures = ASSISTANT_BENCHMARK_DATASET.map((fixture) => {
        const prompt = buildAssistantPrompt(fixture.request, fixture.context);
        if (!prompt.ok) throw new Error(`Cannot build prompt for benchmark fixture ${fixture.id}: ${prompt.diagnostic.code}`);
        return { caseId: fixture.id, inputTokens: model.tokenize(prompt.prompt, true).length };
      });
      const maxInputTokens = Math.max(...fixtures.map((fixture) => fixture.inputTokens));
      console.log(JSON.stringify({ mode: 'token-capacity-measurement', datasetVersion: ASSISTANT_BENCHMARK_DATASET_VERSION, fixtures, maxInputTokens, maxTokens: LOCAL_LLM_GENERATION_OPTIONS.maxTokens, safetyMarginTokens: LOCAL_LLM_CONTEXT_SAFETY_MARGIN_TOKENS, selectedContextSize: selectLocalLlmContextSize(maxInputTokens), generationPerformed: false }));
      return;
    } finally { await model.dispose(); await llama.dispose(); }
  }
  const selected = options.caseId === undefined ? ASSISTANT_BENCHMARK_DATASET : ASSISTANT_BENCHMARK_DATASET.filter((item) => item.id === options.caseId);
  if (selected.length === 0) throw new Error(`Unknown benchmark case: ${options.caseId ?? ''}`);
  const directory = resultDirectory(); await mkdir(directory, { recursive: true });
  const output = resultPath(directory, options.resume ?? options.output ?? `benchmark-${new Date().toISOString().replaceAll(':', '-')}.json`);
  let previous: PersistedResult | undefined;
  if (options.resume) {
    previous = JSON.parse(await readFile(output, 'utf8')) as PersistedResult;
    if (previous.datasetVersion !== ASSISTANT_BENCHMARK_DATASET_VERSION) throw new Error('The resumed result uses a different benchmark dataset version.');
  }
  const resourcesBefore = process.memoryUsage();
  const modelFile = await stat(modelPath);
  const runtime = new NodeLlamaRuntime();
  const provider = new LocalLlmAssistantProvider({ runtime, modelPath, timeoutMs: 300_000 });
  const loadStarted = performance.now(); const initialized = await provider.initialize(); const loadMs = performance.now() - loadStarted;
  if (initialized?.ok === false) throw new Error(initialized.diagnostics.map((item) => item.code).join(','));
  const completed = new Map(previous?.results.map((result) => [result.caseId, result]) ?? []);
  for (const fixture of selected) if (!completed.has(fixture.id)) completed.set(fixture.id, await runBenchmarkCase(provider, fixture));
  await provider.dispose();
  const resourcesAfter = process.memoryUsage();
  const results = ASSISTANT_BENCHMARK_DATASET.filter((fixture) => completed.has(fixture.id)).map((fixture) => completed.get(fixture.id)!);
  const cpu = cpus();
  const persisted: PersistedResult = { datasetVersion: ASSISTANT_BENCHMARK_DATASET_VERSION, model: { id: 'Qwen3-1.7B-Q4_K_M', source: 'ggml-org/Qwen3-1.7B-GGUF', fileName: basename(modelPath), fileSizeBytes: modelFile.size, sha256: 'd2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5', timeoutMs: 300_000, contextBudgetChars: 6_000, contextSize: runtime.contextSize, failedCreationRemedy: false, concurrency: 1, generation: LOCAL_LLM_GENERATION_OPTIONS }, environment: { node: process.version, platform: process.platform, arch: process.arch, cpuModel: cpu[0]?.model ?? null, logicalCpus: cpu.length }, loadMs, resources: { rssBytesBefore: resourcesBefore.rss, rssBytesAfter: resourcesAfter.rss, heapUsedBytesBefore: resourcesBefore.heapUsed, heapUsedBytesAfter: resourcesAfter.heapUsed, vramBytes: null }, manualObservation: null, results, aggregate: aggregateBenchmarkResults(results) };
  const json = JSON.stringify(persisted, null, 2);
  if (Buffer.byteLength(json) > 262_144) throw new Error('Benchmark result exceeds the safe 256 KiB limit.');
  await writeFile(output, json, 'utf8');
  console.log(JSON.stringify({ resultPath: output, datasetVersion: persisted.datasetVersion, cases: results.length, aggregate: persisted.aggregate }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Benchmark failed.'); process.exitCode = 1; });
