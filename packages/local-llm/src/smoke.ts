import { LocalLlmAssistantProvider, NodeLlamaRuntime } from './index.js';

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

const scenario = process.argv[2];
if (scenario === undefined || scenario === '--help' || scenario === '-h') console.log('Usage: node dist/smoke.js <runtime-recovery|isolated-summarize>');
else if (scenario === 'runtime-recovery') await runRuntimeRecovery();
else if (scenario === 'isolated-summarize') await runIsolatedSummarize();
else {
  console.error(`Unknown scenario: ${scenario}`);
  console.log('Usage: node dist/smoke.js <runtime-recovery|isolated-summarize>');
  process.exitCode = 1;
}
