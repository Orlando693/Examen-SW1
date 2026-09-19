import { describe, expect, it } from 'vitest';
import { ASSISTANT_BENCHMARK_DATASET, ASSISTANT_BENCHMARK_DATASET_VERSION } from '../src/benchmark-dataset.js';
import { aggregateBenchmarkResults, runBenchmarkCase, type BenchmarkProvider } from '../src/benchmark.js';

const candidateFor = (id: string): unknown => ({
  'create-class': { version: 1, operation: 'create_class', name: 'Invoice' },
  'rename-class': { version: 1, operation: 'rename_class', class: { id: 'class-user' }, name: 'Member' },
  'delete-class': { version: 1, operation: 'delete_class', class: { id: 'class-order' } },
  'add-attribute': { version: 1, operation: 'add_attribute', class: { id: 'class-user' }, name: 'email', attributeType: 'string' },
  'update-attribute': { version: 1, operation: 'update_attribute', class: { id: 'class-user' }, attribute: { id: 'attribute-user-name' }, name: 'displayName' },
  'delete-attribute': { version: 1, operation: 'delete_attribute', class: { id: 'class-user' }, attribute: { id: 'attribute-user-name' } },
  'create-relation': { version: 1, operation: 'create_relation', kind: 'association', source: { id: 'class-user' }, target: { id: 'class-order' } },
  'update-relation': { version: 1, operation: 'update_relation', relation: { id: 'relationship-user-order' }, name: 'creates' },
  'delete-relation': { version: 1, operation: 'delete_relation', relation: { id: 'relationship-user-order' } },
  'summarize-model': { version: 1, operation: 'summarize_model' },
  'ambiguous-target': { version: 1, operation: 'delete_class', class: { name: 'User' } },
  'missing-target': { version: 1, operation: 'rename_class', class: { name: 'Missing' }, name: 'Present' },
}[id]);

describe('assistant benchmark dataset and metrics', () => {
  it('is versioned and covers every executable v1 operation plus required safety cases', () => {
    expect(ASSISTANT_BENCHMARK_DATASET_VERSION).toMatch(/^assistant-command-v1-/);
    expect(ASSISTANT_BENCHMARK_DATASET.map((item) => item.expected.operation).filter((item) => item !== undefined)).toEqual(expect.arrayContaining(['create_class', 'rename_class', 'delete_class', 'add_attribute', 'update_attribute', 'delete_attribute', 'create_relation', 'update_relation', 'delete_relation', 'summarize_model', 'needs_clarification']));
    expect(ASSISTANT_BENCHMARK_DATASET.map((item) => item.id)).toEqual(expect.arrayContaining(['ambiguous-target', 'missing-target', 'malformed-output', 'unsupported-operation', 'unsafe-output']));
  });

  it('aggregates strict decode, preview, clarification, safety, and timing without a GGUF', async () => {
    const provider: BenchmarkProvider = { interpret: async ({ text, onToken }) => {
      onToken?.('x');
      const fixture = ASSISTANT_BENCHMARK_DATASET.find((item) => item.request === text)!;
      const candidate = candidateFor(fixture.id);
      if (candidate !== undefined) return { ok: true, candidate: candidate as never };
      return { ok: false, diagnostics: [{ code: fixture.expected.diagnosticCode!, message: 'fixture rejection', path: '$' }] };
    } };
    const results = await Promise.all(ASSISTANT_BENCHMARK_DATASET.map((fixture) => runBenchmarkCase(provider, fixture)));
    const aggregate = aggregateBenchmarkResults(results);
    expect(aggregate).toMatchObject({ total: 15, schemaValidity: { passed: 12 }, exactSemanticOperation: { passed: 15 }, referenceResolution: { passed: 15 }, clarification: { eligible: 1, passed: 1 }, failClosed: { passed: 15 }, timing: { firstTokenSamples: 15 } });
    expect(results.every((result) => result.actual.mutated === false)).toBe(true);
  });
});
