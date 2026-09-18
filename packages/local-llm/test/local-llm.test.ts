import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSISTANT_COMMAND_JSON_SCHEMA, decodeAssistantCommand } from '@examen-sw1/assistant-core';
import { LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA, LocalLlmAssistantProvider, NodeLlamaRuntime, buildAssistantPrompt, compactContext, projectAssistantCommandJsonSchema, type LocalLlmRuntime } from '../src/index.js';

const context = { projectId: 'p', revision: 1, classes: [{ id: 'c', name: 'User', attributes: [] }], enumerations: [], relationships: [] };
class FakeRuntime implements LocalLlmRuntime {
  loaded = false; response = '{"version":1,"operation":"summarize_model"}'; loadError: Error | undefined;
  load = vi.fn(async (): Promise<void> => { if (this.loadError) throw this.loadError; this.loaded = true; });
  generate = vi.fn(async (input: { signal: AbortSignal; onToken?: (token: string) => void }): Promise<string> => { if (input.signal.aborted) throw new Error('cancelled'); return this.response; });
  dispose = vi.fn(async (): Promise<void> => { this.loaded = false; });
}

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });
async function modelPath(): Promise<string> { const directory = await mkdtemp(join(tmpdir(), 'local-llm-')); directories.push(directory); const path = join(directory, 'model.gguf'); await writeFile(path, 'fixture'); return path; }
function pendingRuntime(): { runtime: FakeRuntime; release: (value?: string) => void } {
  const runtime = new FakeRuntime(); let release!: (value?: string) => void;
  runtime.generate.mockImplementation((input) => new Promise<string>((resolve, reject) => { release = (value = runtime.response) => resolve(value); input.signal.addEventListener('abort', () => reject(new Error(String(input.signal.reason))), { once: true }); }));
  return { runtime, release: (value) => release(value) };
}

describe('LocalLlmAssistantProvider', () => {
  it('reports unavailable without a model path', async () => expect(await new LocalLlmAssistantProvider({ runtime: new FakeRuntime() }).interpret({ text: 'x', context })).toMatchObject({ ok: false, diagnostics: [{ code: 'MODEL_UNAVAILABLE' }] }));
  it('keeps prompt and context deterministic and bounded', () => {
    const prompt = buildAssistantPrompt('summarize', context); expect(prompt.ok).toBe(true);
    if (prompt.ok) { expect(prompt.prompt).toContain('/no_think'); expect(prompt.prompt).not.toContain('"oneOf"'); }
    expect(compactContext({ ...context, selectedElementId: 'missing' }, 20)).toMatchObject({ ok: false, diagnostic: { code: 'CONTEXT_TOO_LARGE' } });
  });
  it('loads once, reuses the loaded runtime, and disposes it', async () => {
    const runtime = new FakeRuntime(); const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() });
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: true, candidate: { operation: 'summarize_model' } });
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: true });
    expect(runtime.load).toHaveBeenCalledTimes(1); expect(provider.lifecycle).toBe('READY');
    await provider.dispose(); expect(runtime.dispose).toHaveBeenCalledTimes(1); expect(provider.lifecycle).toBe('UNAVAILABLE');
  });
  it('reports unreadable paths and load failures without generating', async () => {
    const unavailable = new LocalLlmAssistantProvider({ runtime: new FakeRuntime(), modelPath: join(tmpdir(), 'missing.gguf') });
    expect(await unavailable.interpret({ text: 'x', context })).toMatchObject({ ok: false, diagnostics: [{ code: 'MODEL_UNAVAILABLE' }] });
    const runtime = new FakeRuntime(); runtime.loadError = new Error('load failed'); const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() });
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: false, diagnostics: [{ code: 'MODEL_LOAD_FAILED' }] });
    expect(runtime.generate).not.toHaveBeenCalled(); expect(provider.lifecycle).toBe('UNAVAILABLE');
  });
  it('decodes only the final response after forwarding streaming chunks', async () => {
    const runtime = new FakeRuntime(); const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() }); const chunks: string[] = []; let settled = false; let finish!: () => void;
    runtime.generate.mockImplementationOnce((input) => new Promise<string>((resolve) => { input.onToken?.('{"version":1,'); input.onToken?.('"operation":"summarize_model"}'); finish = () => resolve(runtime.response); }));
    const request = provider.interpret({ text: 'x', context, onToken: (chunk) => chunks.push(chunk) }).finally(() => { settled = true; });
    await vi.waitFor(() => expect(chunks).toEqual(['{"version":1,', '"operation":"summarize_model"}'])); expect(settled).toBe(false);
    finish(); expect(await request).toMatchObject({ ok: true, candidate: { operation: 'summarize_model' } });
  });
  it('never treats a streamed partial as an executable candidate', async () => {
    const runtime = new FakeRuntime(); const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() }); const chunks: string[] = [];
    runtime.generate.mockImplementationOnce(async (input) => { input.onToken?.('{"version":1,"operation":"summarize_model"}'); return 'not json'; });
    expect(await provider.interpret({ text: 'x', context, onToken: (chunk) => chunks.push(chunk) })).toMatchObject({ ok: false, diagnostics: [{ code: 'INVALID_PROVIDER_OUTPUT' }] });
    expect(chunks).toEqual(['{"version":1,"operation":"summarize_model"}']);
  });
  it('uses one loaded runtime for normal, timeout, external cancellation, and recovery requests', async () => {
    const { runtime, release } = pendingRuntime(); const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath(), timeoutMs: 100 });
    const normal = provider.interpret({ text: 'x', context }); await vi.waitFor(() => expect(runtime.generate).toHaveBeenCalledTimes(1)); release(); expect(await normal).toMatchObject({ ok: true });
    runtime.generate.mockImplementationOnce((input) => new Promise<string>((_resolve, reject) => input.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
    const timed = provider.interpret({ text: 'x', context, timeoutMs: 10 });
    expect(await timed).toMatchObject({ ok: false, diagnostics: [{ code: 'GENERATION_TIMEOUT' }] }); expect(provider.lifecycle).toBe('READY');
    runtime.generate.mockImplementationOnce(async () => runtime.response);
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: true });
    runtime.generate.mockImplementationOnce((input) => new Promise<string>((_resolve, reject) => input.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
    const external = new AbortController(); const request = provider.interpret({ text: 'x', context, signal: external.signal });
    await vi.waitFor(() => expect(provider.lifecycle).toBe('BUSY')); external.abort('timeout');
    expect(await request).toMatchObject({ ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED' }] }); expect(provider.lifecycle).toBe('READY');
    runtime.generate.mockImplementationOnce(async () => runtime.response);
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: true });
    expect(runtime.load).toHaveBeenCalledTimes(1);
  });
  it('enforces one generation while busy and releases the policy after completion', async () => {
    const { runtime, release } = pendingRuntime(); const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() }); const first = provider.interpret({ text: 'x', context });
    await vi.waitFor(() => expect(runtime.generate).toHaveBeenCalledTimes(1));
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: false, diagnostics: [{ code: 'RUNTIME_BUSY' }] });
    release(); expect(await first).toMatchObject({ ok: true }); expect(provider.lifecycle).toBe('READY');
    runtime.generate.mockImplementationOnce(async () => runtime.response);
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: true }); expect(runtime.generate).toHaveBeenCalledTimes(2);
  });
  it('distinguishes unexpected generation failures and recovers without reloading', async () => {
    const runtime = new FakeRuntime(); runtime.generate.mockRejectedValueOnce(new Error('unexpected runtime failure'));
    const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() });
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: false, diagnostics: [{ code: 'GENERATION_FAILED' }] });
    expect(provider.lifecycle).toBe('READY');
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: true });
    expect(runtime.load).toHaveBeenCalledTimes(1);
  });
  it('disposes an active generation, ignores late tokens, and reloads on recovery', async () => {
    const runtime = new FakeRuntime(); let emitLateToken!: () => void; const chunks: string[] = [];
    runtime.generate.mockImplementationOnce((input) => new Promise<string>((_resolve, reject) => {
      input.onToken?.('partial');
      emitLateToken = () => input.onToken?.('late');
      input.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    }));
    const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() });
    const request = provider.interpret({ text: 'x', context, onToken: (chunk) => chunks.push(chunk) });
    await vi.waitFor(() => expect(provider.lifecycle).toBe('BUSY'));
    await provider.dispose();
    emitLateToken();
    expect(await request).toMatchObject({ ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED' }] });
    expect(chunks).toEqual(['partial']);
    expect(provider.lifecycle).toBe('UNAVAILABLE');
    expect(await provider.interpret({ text: 'x', context })).toMatchObject({ ok: true });
    expect(runtime.load).toHaveBeenCalledTimes(2);
  });
  it('keeps malformed and unsafe final output isolated in the strict decoder', async () => {
    for (const response of ['not json', '{"version":1,"operation":"create_class","name":"https://unsafe"}', '{"version":1,"operation":"summarize_model","tool":"run"}']) {
      const runtime = new FakeRuntime(); runtime.response = response; const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath() }); const result = await provider.interpret({ text: 'x', context });
      expect(result.ok).toBe(false); if (result.ok) continue; expect(decodeAssistantCommand(response === 'not json' ? {} : JSON.parse(response)).ok).toBe(false);
    }
  });
});

type Schema = Record<string, unknown>;
const propertiesOf = (branch: Schema): Record<string, Schema> => branch.properties as Record<string, Schema>;
const referenceFor = (branch: Schema, field: string): { id: string } | { name: string } => (propertiesOf(branch)[field].required as string[]).includes('id') ? { id: `${field}-id` } : { name: `${field}-name` };
const operationOf = (branch: Schema): string => propertiesOf(branch).operation.const as string;
const hasNestedUnion = (value: unknown): boolean => Array.isArray(value) ? value.some(hasNestedUnion) : typeof value === 'object' && value !== null && Object.entries(value).some(([key, item]) => key === 'oneOf' || key === 'anyOf' || hasNestedUnion(item));
const upperPattern = (branch: Schema, field: 'sourceMultiplicity' | 'targetMultiplicity'): 'integer' | '*' | 'null' => {
  const multiplicity = propertiesOf(branch)[field];
  if (multiplicity.type === 'null') return 'null';
  const upper = (multiplicity.properties as Record<string, Schema>).upper;
  return upper.const === '*' ? '*' : 'integer';
};
function fixtureForBranch(branch: Schema): unknown {
  const operation = operationOf(branch);
  switch (operation) {
    case 'create_class': return { version: 1, operation, name: 'User' };
    case 'rename_class': return { version: 1, operation, class: referenceFor(branch, 'class'), name: 'Member' };
    case 'delete_class': return { version: 1, operation, class: referenceFor(branch, 'class') };
    case 'add_attribute': return { version: 1, operation, class: referenceFor(branch, 'class'), name: 'email', attributeType: 'string' };
    case 'update_attribute': return { version: 1, operation, class: referenceFor(branch, 'class'), attribute: referenceFor(branch, 'attribute'), name: 'emailAddress' };
    case 'delete_attribute': return { version: 1, operation, class: referenceFor(branch, 'class'), attribute: referenceFor(branch, 'attribute') };
    case 'create_relation': return { version: 1, operation, kind: 'association', source: referenceFor(branch, 'source'), target: referenceFor(branch, 'target') };
    case 'update_relation': return { version: 1, operation, relation: referenceFor(branch, 'relation'), name: 'owns' };
    case 'delete_relation': return { version: 1, operation, relation: referenceFor(branch, 'relation') };
    case 'summarize_model': return { version: 1, operation };
    default: throw new Error(`Unexpected projected operation: ${String(operation)}`);
  }
}

describe('local grammar projection', () => {
  it('expands nested unions without mutating the canonical schema', () => {
    const before = structuredClone(ASSISTANT_COMMAND_JSON_SCHEMA);
    const projected = projectAssistantCommandJsonSchema();
    expect(projected).toEqual(LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA);
    expect(projected).not.toBe(ASSISTANT_COMMAND_JSON_SCHEMA);
    expect(ASSISTANT_COMMAND_JSON_SCHEMA).toEqual(before);
    expect((projected.oneOf as Schema[])).toHaveLength(146);
    expect((projected.oneOf as Schema[]).every((branch) => !hasNestedUnion(branch))).toBe(true);
  });

  it('creates closed multiplicity alternatives for create_relation and update_relation', () => {
    const branches = LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA.oneOf as Schema[];
    const create = branches.filter((branch) => operationOf(branch) === 'create_relation');
    const update = branches.filter((branch) => operationOf(branch) === 'update_relation');
    expect(create).toHaveLength(16); expect(update).toHaveLength(108);
    expect(new Set(create.flatMap((branch) => [upperPattern(branch, 'sourceMultiplicity'), upperPattern(branch, 'targetMultiplicity')]))).toEqual(new Set(['integer', '*']));
    expect(new Set(update.flatMap((branch) => [upperPattern(branch, 'sourceMultiplicity'), upperPattern(branch, 'targetMultiplicity')]))).toEqual(new Set(['integer', '*', 'null']));
  });

  it('bounds projected union expansion deterministically', () => {
    const schema = { oneOf: Array.from({ length: 513 }, (_, index) => ({ type: 'object', properties: { value: { const: index } } })) };
    expect(() => projectAssistantCommandJsonSchema(schema, 512)).toThrow('512 alternative limit');
    expect(() => projectAssistantCommandJsonSchema(schema, 0)).toThrow('positive safe integer');
  });

  it('keeps id and name references valid while rejecting invalid XOR shapes in the decoder', () => {
    for (const reference of [{ id: 'class-id' }, { name: 'User' }]) {
      expect(decodeAssistantCommand({ version: 1, operation: 'delete_class', class: reference }).ok).toBe(true);
    }
    for (const reference of [null, {}, { id: 'class-id', name: 'User' }, { unknown: 'class-id' }]) {
      expect(decodeAssistantCommand({ version: 1, operation: 'delete_class', class: reference }).ok).toBe(false);
    }
  });

  it('produces a decoder-valid fixture for every projected command branch', () => {
    const branches = LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA.oneOf as Schema[];
    expect(branches).toHaveLength(146);
    for (const branch of branches) expect(decodeAssistantCommand(fixtureForBranch(branch)).ok).toBe(true);
  });

  it('decodes complete integer and star multiplicity relation commands while rejecting invalid upper values', () => {
    for (const upper of [3, '*'] as const) {
      expect(decodeAssistantCommand({ version: 1, operation: 'create_relation', kind: 'association', source: { id: 'source-id' }, target: { name: 'Target' }, sourceMultiplicity: { lower: 0, upper }, targetMultiplicity: { lower: 1, upper } }).ok).toBe(true);
      expect(decodeAssistantCommand({ version: 1, operation: 'update_relation', relation: { id: 'relation-id' }, sourceMultiplicity: { lower: 0, upper }, targetMultiplicity: { lower: 1, upper } }).ok).toBe(true);
    }
    for (const upper of [null, {}, '3', 1.5, undefined]) {
      const command = { version: 1, operation: 'update_relation', relation: { id: 'relation-id' }, sourceMultiplicity: { lower: 0, ...(upper === undefined ? {} : { upper }) } };
      expect(decodeAssistantCommand(command).ok).toBe(false);
    }
  });

  it('passes the complete projected schema to NodeLlamaRuntime', async () => {
    const createGrammarForJsonSchema = vi.fn(async () => ({ parse: () => undefined }));
    const prompts: string[][] = []; const sessions: { dispose: ReturnType<typeof vi.fn> }[] = [];
    class Session {
      constructor(options: unknown) { void options; prompts.push([]); sessions.push(this); }
      async prompt(value: string) { prompts.at(-1)?.push(value); return '{"version":1,"operation":"summarize_model"}'; }
      dispose = vi.fn();
    }
    const loadModel = vi.fn(async () => ({ createContext: async () => ({ getSequence: () => ({}) }) }));
    const runtime = new NodeLlamaRuntime(async () => ({ getLlama: async () => ({ loadModel, createGrammarForJsonSchema }), LlamaChatSession: Session } as never));
    await runtime.load('model.gguf');
    await runtime.generate({ prompt: 'x', signal: new AbortController().signal });
    expect(createGrammarForJsonSchema).toHaveBeenCalledWith(LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA);
    expect(prompts).toEqual([['x']]); expect(sessions[0]?.dispose).toHaveBeenCalledOnce();
  });

  it('does not retain a stale session after timeout or cancellation while loading once', async () => {
    const histories: string[][] = []; const sessionOptions: unknown[] = []; const sessions: { dispose: ReturnType<typeof vi.fn> }[] = []; const loadModel = vi.fn(async () => ({ createContext: async () => ({ getSequence: () => ({}) }) }));
    class Session {
      private readonly history: string[] = [];
      constructor(options: unknown) { sessionOptions.push(options); histories.push(this.history); sessions.push(this); }
      prompt(value: string, options: { signal?: AbortSignal }) {
        this.history.push(value);
        if (value.includes('USER: timeout') || value.includes('USER: cancel')) return new Promise<string>((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
        return Promise.resolve('{"version":1,"operation":"summarize_model"}');
      }
      dispose = vi.fn();
    }
    const runtime = new NodeLlamaRuntime(async () => ({ getLlama: async () => ({ loadModel, createGrammarForJsonSchema: async () => ({ parse: () => undefined }) }), LlamaChatSession: Session } as never));
    const provider = new LocalLlmAssistantProvider({ runtime, modelPath: await modelPath(), timeoutMs: 1_000 });
    expect(await provider.interpret({ text: 'timeout', context, timeoutMs: 10 })).toMatchObject({ ok: false, diagnostics: [{ code: 'GENERATION_TIMEOUT' }] });
    const external = new AbortController(); const cancelling = provider.interpret({ text: 'cancel', context, signal: external.signal }); await vi.waitFor(() => expect(histories).toHaveLength(2)); external.abort();
    expect(await cancelling).toMatchObject({ ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED' }] });
    expect(await provider.interpret({ text: 'fresh', context })).toMatchObject({ ok: true });
    expect(loadModel).toHaveBeenCalledOnce(); expect(histories.map(([prompt]) => prompt.slice(prompt.lastIndexOf('USER: ') + 6))).toEqual(['timeout', 'cancel', 'fresh']); expect(sessionOptions).toEqual([{ contextSequence: {}, autoDisposeSequence: true }, { contextSequence: {}, autoDisposeSequence: true }, { contextSequence: {}, autoDisposeSequence: true }]); expect(sessions.every((session) => session.dispose.mock.calls.length === 1)).toBe(true);
  });

  it('constructs the full projected grammar with node-llama-cpp without loading a model', async () => {
    const { getLlama } = await import('node-llama-cpp');
    const llama = await getLlama({ build: 'never' });
    try {
      await expect(llama.createGrammarForJsonSchema(LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA as never)).resolves.toBeDefined();
    } finally {
      await llama.dispose?.();
    }
  }, 30_000);
});
