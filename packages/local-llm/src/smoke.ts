import { LOCAL_LLM_DEFAULT_CONTEXT_SIZE, LocalLlmAssistantProvider, NodeLlamaRuntime } from './index.js';
import { freemem, totalmem } from 'node:os';

const createProvider = () => new LocalLlmAssistantProvider({ runtime: new NodeLlamaRuntime(), timeoutMs: 300_000 });

async function runRuntimeRecovery(): Promise<void> {
  const provider = createProvider();
  const startedAt = Date.now();
  const initialized = await provider.initialize();
  const readyAt = Date.now();
  if (initialized?.ok === false) { console.error(initialized.diagnostics); process.exitCode = 1; }
  else {
    const context = { projectId: 'local-smoke', revision: 1, classes: [], enumerations: [], relationships: [] };
    const started = Date.now(); const requestA = provider.interpret({ text: 'resume el modelo UML', context });
    while (provider.lifecycle !== 'BUSY') await new Promise((resolve) => setTimeout(resolve, 10));
    const busy = await provider.interpret({ text: 'resume el modelo UML', context });
    setTimeout(() => provider.cancel(), 2_000); const cancelled = await requestA;
    const timedOut = await provider.interpret({ text: 'resume el modelo UML', context, timeoutMs: 2_000 });
    let chunks = 0; let firstTokenAt: number | undefined; const recovered = await provider.interpret({ text: 'resume el modelo UML', context, onToken: () => { chunks++; firstTokenAt ??= Date.now(); } });
    const isReady = () => provider.lifecycle === 'READY';
    const completed = Date.now(); console.log(JSON.stringify({ modelLoadMs: readyAt - startedAt, busy, cancelled, cancelReady: isReady(), timedOut, timeoutReady: isReady(), recovered, chunks, firstTokenMs: firstTokenAt === undefined ? null : firstTokenAt - started, totalMs: completed - started }));
    if (!('ok' in busy) || busy.ok || cancelled.ok || timedOut.ok || !recovered.ok || recovered.candidate.operation !== 'summarize_model') process.exitCode = 1;
  }
  await provider.dispose();
}

async function runIsolatedSummarize(): Promise<void> {
  const provider = createProvider();
  const startedAt = Date.now();
  const initialized = await provider.initialize();
  const readyAt = Date.now();
  if (initialized?.ok === false) {
    console.log(JSON.stringify({ scenario: 'isolated-summarize', modelLoadMs: readyAt - startedAt, chunks: 0, firstTokenMs: null, totalMs: readyAt - startedAt, result: initialized, raw: null }));
    process.exitCode = 1;
  } else {
    const context = { projectId: 'isolated-summarize', revision: 1, classes: [{ id: 'class-1', name: 'Smoke', attributes: [] }], enumerations: [], relationships: [] };
    let chunks = 0; let firstTokenAt: number | undefined;
    const result = await provider.interpret({ text: 'resume el modelo UML', context, onToken: () => { chunks++; firstTokenAt ??= Date.now(); } });
    const completed = Date.now();
    console.log(JSON.stringify({ scenario: 'isolated-summarize', modelLoadMs: readyAt - startedAt, chunks, firstTokenMs: firstTokenAt === undefined ? null : firstTokenAt - readyAt, totalMs: completed - startedAt, result, raw: result.ok ? result.raw : null }));
    if (!result.ok || result.candidate.operation !== 'summarize_model') process.exitCode = 1;
  }
  await provider.dispose();
}

async function inspectContext(): Promise<unknown> {
  const modelPath = process.env.LOCAL_LLM_MODEL_PATH;
  if (!modelPath) throw new Error('LOCAL_LLM_MODEL_PATH is required.');
  const before = process.memoryUsage();
  const { getLlama } = await import('node-llama-cpp');
  const llama = await getLlama({ build: 'never' });
  const model = await llama.loadModel({ modelPath });
  const modelInfo = { trainContextSize: model.trainContextSize, memoryUsage: model.memoryUsage };
  const startedAt = performance.now();
  try {
    const context = await model.createContext({ contextSize: LOCAL_LLM_DEFAULT_CONTEXT_SIZE, failedCreationRemedy: false });
    const result = { requestedContextSize: LOCAL_LLM_DEFAULT_CONTEXT_SIZE, resolved: true, createContextMs: performance.now() - startedAt, model: modelInfo, before: { totalRam: totalmem(), freeRam: freemem(), rss: before.rss, heapUsed: before.heapUsed, external: before.external }, context: { allocatedContextSize: context.getAllocatedContextSize(), memoryUsage: context.memoryUsage, stateSize: context.stateSize, totalSequences: context.totalSequences, sequencesLeft: context.sequencesLeft }, after: process.memoryUsage() };
    await context.dispose();
    return result;
  } catch (error) {
    return { requestedContextSize: LOCAL_LLM_DEFAULT_CONTEXT_SIZE, resolved: false, createContextMs: performance.now() - startedAt, model: modelInfo, before: { totalRam: totalmem(), freeRam: freemem(), rss: before.rss, heapUsed: before.heapUsed, external: before.external }, error: error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError', message: String(error) } };
  } finally { await model.dispose(); await llama.dispose(); }
}

async function runContextInitDiagnostic(): Promise<void> {
  console.log(JSON.stringify({ scenario: 'context-init-diagnostic', normalRuntimePolicy: LOCAL_LLM_DEFAULT_CONTEXT_SIZE, context: await inspectContext(), generationPerformed: false }));
}

const scenario = process.argv[2];
if (scenario === undefined || scenario === '--help' || scenario === '-h') console.log('Usage: node dist/smoke.js <runtime-recovery|isolated-summarize|context-init-diagnostic>');
else if (scenario === 'runtime-recovery') await runRuntimeRecovery();
else if (scenario === 'isolated-summarize') await runIsolatedSummarize();
else if (scenario === 'context-init-diagnostic') await runContextInitDiagnostic();
else {
  console.error(`Unknown scenario: ${scenario}`);
  console.log('Usage: node dist/smoke.js <runtime-recovery|isolated-summarize>');
  process.exitCode = 1;
}
