import { createPreview, type AssistantCommand, type AssistantDiagnostic, type AssistantModelContext } from '@examen-sw1/assistant-core';
import { ASSISTANT_BENCHMARK_DATASET_VERSION, type AssistantBenchmarkCase } from './benchmark-dataset.js';

export interface BenchmarkProviderResult { ok: boolean; candidate?: AssistantCommand; diagnostics?: AssistantDiagnostic[]; }
export interface BenchmarkProvider {
  interpret(input: { text: string; context: AssistantModelContext; onToken?: (token: string) => void }): Promise<BenchmarkProviderResult>;
}
export interface BenchmarkCaseResult {
  caseId: string;
  expected: AssistantBenchmarkCase['expected'];
  actual: { outcome: 'preview' | 'clarification' | 'rejected'; operation?: string; diagnosticCodes: string[]; destructive?: boolean; mutated: false };
  metrics: { schemaValid: boolean; exactSemanticOperation: boolean; referenceResolution: boolean; clarification: boolean; failClosed: boolean; elapsedMs: number; firstTokenMs: number | null; };
}

const codes = (diagnostics: AssistantDiagnostic[] | undefined): string[] => diagnostics?.map((diagnostic) => diagnostic.code) ?? [];

/** Runs only provider -> strict decode (inside provider) -> createPreview; no apply path is available here. */
export async function runBenchmarkCase(provider: BenchmarkProvider, fixture: AssistantBenchmarkCase): Promise<BenchmarkCaseResult> {
  const before = structuredClone(fixture.context);
  const startedAt = performance.now();
  let firstTokenAt: number | undefined;
  const generated = await provider.interpret({ text: fixture.request, context: fixture.context, onToken: () => { firstTokenAt ??= performance.now(); } });
  const elapsedMs = performance.now() - startedAt;
  const unchanged = JSON.stringify(before) === JSON.stringify(fixture.context);
  if (!unchanged) throw new Error(`Benchmark fixture ${fixture.id} was mutated during interpretation.`);
  let actual: BenchmarkCaseResult['actual'];
  let referenceResolution = false;
  if (!generated.ok || generated.candidate === undefined) {
    actual = { outcome: 'rejected', diagnosticCodes: codes(generated.diagnostics), mutated: false };
  } else {
    const preview = createPreview(fixture.request, generated.candidate, fixture.context);
    if (preview.ok) {
      actual = { outcome: 'preview', operation: generated.candidate.operation, diagnosticCodes: [], destructive: preview.preview.requiresConfirmation, mutated: false };
      referenceResolution = true;
    } else if (preview.clarification !== undefined) {
      actual = { outcome: 'clarification', operation: preview.clarification.operation, diagnosticCodes: codes(preview.diagnostics), mutated: false };
      referenceResolution = true;
    } else {
      actual = { outcome: 'rejected', operation: generated.candidate.operation, diagnosticCodes: codes(preview.diagnostics), mutated: false };
    }
  }
  const expected = fixture.expected;
  const schemaValid = generated.ok && generated.candidate !== undefined;
  const exactSemanticOperation = expected.operation === undefined ? actual.operation === undefined : actual.operation === expected.operation;
  const outcomeCorrect = actual.outcome === expected.outcome;
  const diagnosticCorrect = expected.diagnosticCode === undefined || actual.diagnosticCodes.includes(expected.diagnosticCode);
  const destructiveCorrect = expected.destructive === undefined || actual.destructive === expected.destructive;
  return {
    caseId: fixture.id,
    expected,
    actual,
    metrics: {
      schemaValid,
      exactSemanticOperation,
      referenceResolution: expected.outcome === 'rejected' ? diagnosticCorrect : referenceResolution && outcomeCorrect,
      clarification: expected.outcome === 'clarification' ? outcomeCorrect : actual.outcome !== 'clarification',
      failClosed: expected.outcome === 'rejected' ? actual.outcome === 'rejected' && diagnosticCorrect : outcomeCorrect && destructiveCorrect,
      elapsedMs,
      firstTokenMs: firstTokenAt === undefined ? null : firstTokenAt - startedAt,
    },
  };
}

export interface BenchmarkAggregate { total: number; schemaValidity: { passed: number; }; exactSemanticOperation: { passed: number; }; referenceResolution: { passed: number; }; clarification: { eligible: number; passed: number; }; failClosed: { passed: number; }; timing: { totalMs: number; averageMs: number; firstTokenSamples: number; averageFirstTokenMs: number | null; }; }

export function aggregateBenchmarkResults(results: ReadonlyArray<BenchmarkCaseResult>): BenchmarkAggregate {
  const totalMs = results.reduce((sum, result) => sum + result.metrics.elapsedMs, 0);
  const firstTokens = results.flatMap((result) => result.metrics.firstTokenMs === null ? [] : [result.metrics.firstTokenMs]);
  const count = (key: keyof BenchmarkCaseResult['metrics']) => results.filter((result) => result.metrics[key] === true).length;
  const clarification = results.filter((result) => result.expected.outcome === 'clarification');
  return {
    total: results.length,
    schemaValidity: { passed: count('schemaValid') },
    exactSemanticOperation: { passed: count('exactSemanticOperation') },
    referenceResolution: { passed: count('referenceResolution') },
    clarification: { eligible: clarification.length, passed: clarification.filter((result) => result.metrics.clarification).length },
    failClosed: { passed: count('failClosed') },
    timing: { totalMs, averageMs: results.length === 0 ? 0 : totalMs / results.length, firstTokenSamples: firstTokens.length, averageFirstTokenMs: firstTokens.length === 0 ? null : firstTokens.reduce((sum, value) => sum + value, 0) / firstTokens.length },
  };
}

export { ASSISTANT_BENCHMARK_DATASET_VERSION };
