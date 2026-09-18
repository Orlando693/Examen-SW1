import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import {
  ASSISTANT_COMMAND_JSON_SCHEMA,
  decodeAssistantCommand,
  type AssistantCommand,
  type AssistantDiagnostic,
  type AssistantModelContext,
  type AssistantProvider,
} from '@examen-sw1/assistant-core';

type JsonSchema = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonSchema => typeof value === 'object' && value !== null && !Array.isArray(value);
const MAX_PROJECTED_SCHEMA_ALTERNATIVES = 512;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function uniqueAlternatives<T>(alternatives: T[], maxAlternatives: number): T[] {
  const unique = new Map<string, T>();
  for (const alternative of alternatives) unique.set(stableJson(alternative), alternative);
  const ordered = [...unique.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, alternative]) => alternative);
  if (ordered.length > maxAlternatives) throw new RangeError(`Projected JSON schema exceeds the ${maxAlternatives} alternative limit.`);
  return ordered;
}

function mergeSchemas(base: JsonSchema, alternative: JsonSchema): JsonSchema {
  const merged: JsonSchema = { ...base };
  for (const [key, value] of Object.entries(alternative)) {
    if (key === 'properties' && isRecord(merged.properties) && isRecord(value)) merged.properties = { ...merged.properties, ...value };
    else if (key === 'required' && Array.isArray(merged.required) && Array.isArray(value)) merged.required = [...new Set([...merged.required, ...value])];
    else merged[key] = value;
  }
  return merged;
}

function expandSchemaObject(value: JsonSchema, maxAlternatives: number): JsonSchema[] {
  return Object.entries(value).reduce<JsonSchema[]>((combinations, [key, item]) => uniqueAlternatives(combinations.flatMap((combination) => expandSchemaUnions(item, maxAlternatives).map((expanded) => ({ ...combination, [key]: expanded }))), maxAlternatives), [{}]);
}

/** Expands unsupported nested JSON-schema unions into closed command-level alternatives. */
function expandSchemaUnions(value: unknown, maxAlternatives: number): unknown[] {
  if (Array.isArray(value)) {
    return uniqueAlternatives(value.reduce<unknown[][]>((combinations, item) => uniqueAlternatives(combinations.flatMap((combination) => expandSchemaUnions(item, maxAlternatives).map((expanded) => [...combination, expanded])), maxAlternatives), [[]]), maxAlternatives);
  }
  if (!isRecord(value)) return [value];
  const { oneOf, anyOf, ...base } = value;
  let alternatives = expandSchemaObject(base, maxAlternatives);
  for (const union of [oneOf, anyOf]) {
    if (!Array.isArray(union)) continue;
    const expandedUnion = uniqueAlternatives(union.flatMap((alternative) => expandSchemaUnions(alternative, maxAlternatives)), maxAlternatives) as JsonSchema[];
    alternatives = uniqueAlternatives(alternatives.flatMap((baseAlternative) => expandedUnion.map((alternative) => mergeSchemas(baseAlternative, alternative))), maxAlternatives);
  }
  return alternatives;
}

/** Local grammar only; the canonical schema and decoder remain the semantic authority. */
export function projectAssistantCommandJsonSchema(schema: JsonSchema = ASSISTANT_COMMAND_JSON_SCHEMA, maxAlternatives = MAX_PROJECTED_SCHEMA_ALTERNATIVES): JsonSchema {
  if (!Number.isSafeInteger(maxAlternatives) || maxAlternatives < 1) throw new RangeError('The projected JSON schema alternative limit must be a positive safe integer.');
  const { oneOf, anyOf, ...base } = schema;
  if (!Array.isArray(oneOf)) return structuredClone(schema);
  const branches = uniqueAlternatives(oneOf.flatMap((branch) => expandSchemaUnions(branch, maxAlternatives)), maxAlternatives);
  return { ...base, ...(anyOf === undefined ? {} : { anyOf: structuredClone(anyOf) }), oneOf: branches };
}

export const LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA = projectAssistantCommandJsonSchema();

export type LocalLlmLifecycle = 'UNAVAILABLE' | 'LOADING' | 'READY' | 'BUSY' | 'ERROR';
export type LocalLlmResult = { ok: true; candidate: AssistantCommand; raw: string; } | { ok: false; diagnostics: AssistantDiagnostic[]; };
export interface LocalLlmRuntime {
  load(modelPath: string): Promise<void>;
  generate(input: { prompt: string; signal: AbortSignal; onToken?: (token: string) => void }): Promise<string>;
  dispose(): Promise<void>;
}
export interface LocalLlmOptions { modelPath?: string; timeoutMs?: number; contextBudgetChars?: number; runtime: LocalLlmRuntime; }
export interface LocalLlmInterpretInput {
  text: string;
  context: AssistantModelContext;
  signal?: AbortSignal;
  timeoutMs?: number;
  onToken?: (token: string) => void;
}
type NodeLlamaModule = typeof import('node-llama-cpp');
const failure = (code: string, message: string): LocalLlmResult => ({ ok: false, diagnostics: [{ code, message, path: '$' }] });

export function compactContext(context: AssistantModelContext, budgetChars = 6000): { ok: true; value: AssistantModelContext } | { ok: false; diagnostic: AssistantDiagnostic } {
  const selected = context.selectedElementId;
  const base = { projectId: context.projectId, revision: context.revision, classes: [] as AssistantModelContext['classes'], enumerations: [] as AssistantModelContext['enumerations'], relationships: [] as AssistantModelContext['relationships'], ...(selected === undefined ? {} : { selectedElementId: selected }) };
  const append = <T>(target: T[], item: T): boolean => { target.push(item); if (JSON.stringify(base).length <= budgetChars) return true; target.pop(); return false; };
  for (const item of context.classes) if (!append(base.classes, item)) break;
  for (const item of context.enumerations) if (!append(base.enumerations, item)) break;
  for (const item of context.relationships) if (!append(base.relationships, item)) break;
  if (selected !== undefined && ![...base.classes.map((item) => item.id), ...base.enumerations.map((item) => item.id), ...base.relationships.map((item) => item.id)].includes(selected)) return { ok: false, diagnostic: { code: 'CONTEXT_TOO_LARGE', message: 'The selected element cannot fit in the context budget.', path: '$.selectedElementId' } };
  return { ok: true, value: base };
}

export function buildAssistantPrompt(text: string, context: AssistantModelContext, budgetChars = 6000): { ok: true; prompt: string } | { ok: false; diagnostic: AssistantDiagnostic } {
  const compact = compactContext(context, budgetChars); if (!compact.ok) return compact;
  return { ok: true, prompt: `SYSTEM: /no_think Return exactly one AssistantCommand v1 JSON object. No prose, markdown, explanation, thinking output, SQL, shell, URLs, tools, or code. Select only fields required by the requested operation.\nCONTEXT: ${JSON.stringify(compact.value)}\nUSER: ${text}` };
}

/** Local-only provider. It owns no ProjectDocument, mutation bus, database, or tools. */
export class LocalLlmAssistantProvider implements AssistantProvider {
  private state: LocalLlmLifecycle = 'UNAVAILABLE';
  private active: AbortController | undefined;
  private loadedPath: string | undefined;
  private lifecycleEpoch = 0;
  readonly timeoutMs: number;
  readonly contextBudgetChars: number;
  constructor(private readonly options: LocalLlmOptions) { this.timeoutMs = options.timeoutMs ?? 20_000; this.contextBudgetChars = options.contextBudgetChars ?? 6_000; }
  get lifecycle(): LocalLlmLifecycle { return this.state; }
  async initialize(): Promise<LocalLlmResult | undefined> {
    const epoch = this.lifecycleEpoch;
    const modelPath = this.options.modelPath ?? process.env.LOCAL_LLM_MODEL_PATH;
    if (!modelPath) { this.state = 'UNAVAILABLE'; return failure('MODEL_UNAVAILABLE', 'LOCAL_LLM_MODEL_PATH is not configured.'); }
    if (this.loadedPath === modelPath && this.state === 'READY') return undefined;
    try { await access(modelPath, constants.R_OK); } catch { this.state = 'UNAVAILABLE'; return failure('MODEL_UNAVAILABLE', 'The configured local model cannot be read.'); }
    if (!modelPath.toLowerCase().endsWith('.gguf')) { this.state = 'ERROR'; return failure('INVALID_MODEL_PATH', 'The configured local model must be a GGUF file.'); }
    this.state = 'LOADING';
    try {
      await this.options.runtime.load(modelPath);
      if (epoch !== this.lifecycleEpoch) {
        await this.options.runtime.dispose();
        return failure('MODEL_UNAVAILABLE', 'The local model was disposed while loading.');
      }
      this.loadedPath = modelPath; this.state = 'READY'; return undefined;
    } catch {
      if (epoch === this.lifecycleEpoch) this.state = 'ERROR';
      return failure('MODEL_LOAD_FAILED', 'The local GGUF model could not be loaded.');
    }
  }
  async interpret(input: LocalLlmInterpretInput): Promise<LocalLlmResult> {
    if (this.active) return failure('RUNTIME_BUSY', 'Only one local generation may run at a time.');
    const controller = new AbortController(); const epoch = this.lifecycleEpoch; this.active = controller;
    let timedOut = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const cancelFromExternalSignal = () => { timers.forEach(clearTimeout); controller.abort('external'); };
    input.signal?.addEventListener('abort', cancelFromExternalSignal, { once: true });
    if (input.signal?.aborted) cancelFromExternalSignal();
    try {
      if (controller.signal.aborted) return failure('GENERATION_CANCELLED', 'Local generation was cancelled.');
      const initialized = await this.initialize(); if (initialized) return initialized;
      if (controller.signal.aborted) return failure('GENERATION_CANCELLED', 'Local generation was cancelled.');
      const prompt = buildAssistantPrompt(input.text, input.context, this.contextBudgetChars); if (!prompt.ok) return { ok: false, diagnostics: [prompt.diagnostic] };
      this.state = 'BUSY';
      const timeouts = [this.timeoutMs, input.timeoutMs].filter((timeout): timeout is number => timeout !== undefined);
      timers = timeouts.map((timeout) => setTimeout(() => { timedOut = true; controller.abort('timeout'); }, timeout));
      let raw: string;
      try {
        raw = await this.options.runtime.generate({
          prompt: prompt.prompt,
          signal: controller.signal,
          // Partial output is display-only; only the final response reaches the decoder.
          onToken: (token) => {
            if (controller.signal.aborted || this.active !== controller) return;
            try { input.onToken?.(token); } catch { /* Observer failures must not affect generation. */ }
          },
        });
      }
      finally { timers.forEach(clearTimeout); }
      if (controller.signal.aborted) return failure(timedOut ? 'GENERATION_TIMEOUT' : 'GENERATION_CANCELLED', timedOut ? 'Local generation timed out.' : 'Local generation was cancelled.');
      let candidate: unknown; try { candidate = JSON.parse(raw); } catch { return failure('INVALID_PROVIDER_OUTPUT', 'The local model did not return JSON.'); }
      const decoded = decodeAssistantCommand(candidate); return decoded.ok ? { ok: true, candidate: decoded.command, raw } : { ok: false, diagnostics: decoded.diagnostics };
    } catch { return failure(controller.signal.aborted ? (timedOut ? 'GENERATION_TIMEOUT' : 'GENERATION_CANCELLED') : 'GENERATION_FAILED', controller.signal.aborted ? (timedOut ? 'Local generation timed out.' : 'Local generation was cancelled.') : 'Local generation failed.'); }
    finally {
      input.signal?.removeEventListener('abort', cancelFromExternalSignal);
      if (this.active === controller) this.active = undefined;
      if (epoch === this.lifecycleEpoch) this.state = this.loadedPath === undefined ? 'UNAVAILABLE' : 'READY';
    }
  }
  cancel(): boolean { if (!this.active) return false; this.active.abort('cancelled'); return true; }
  async dispose(): Promise<void> {
    this.lifecycleEpoch++;
    this.cancel();
    this.loadedPath = undefined;
    this.state = 'UNAVAILABLE';
    await this.options.runtime.dispose();
  }
}

export class NodeLlamaRuntime implements LocalLlmRuntime {
  private llama: { loadModel(input: { modelPath: string }): Promise<{ createContext(): Promise<{ getSequence(): unknown; dispose?(): Promise<void> | void }> ; dispose?(): Promise<void> | void }>; createGrammarForJsonSchema(schema: object): Promise<{ parse(text: string): unknown }>; dispose?(): Promise<void> | void } | undefined;
  private context: { getSequence(): unknown; dispose?(): Promise<void> | void } | undefined;
  private model: { dispose?(): Promise<void> | void } | undefined;
  private module: NodeLlamaModule | undefined;
  constructor(private readonly moduleLoader: () => Promise<NodeLlamaModule> = () => import('node-llama-cpp')) {}
  async load(modelPath: string): Promise<void> {
    const module = await this.moduleLoader(); const llama = await module.getLlama({ build: 'never' }); const model = await llama.loadModel({ modelPath }); const context = await model.createContext();
    this.module = module; this.llama = llama; this.model = model; this.context = context;
  }
  async generate(input: { prompt: string; signal: AbortSignal; onToken?: (token: string) => void }): Promise<string> {
    if (!this.llama || !this.context) throw new Error('runtime not loaded');
    const grammar = await this.llama.createGrammarForJsonSchema(LOCAL_LLM_ASSISTANT_COMMAND_JSON_SCHEMA);
    if (!this.module) throw new Error('runtime not loaded');
    // A chat session owns history. Keep the loaded model/context, but isolate every request.
    const session = new this.module.LlamaChatSession({ contextSequence: this.context.getSequence() as never, autoDisposeSequence: true });
    try {
      return await session.prompt(input.prompt, { grammar: grammar as never, onTextChunk: input.onToken, signal: input.signal, maxTokens: 128, temperature: 0.7, topP: 0.8, topK: 20, minP: 0, budgets: { thoughtTokens: 0 } });
    } finally { session.dispose(); }
  }
  async dispose(): Promise<void> { await this.context?.dispose?.(); await this.model?.dispose?.(); await this.llama?.dispose?.(); this.context = undefined; this.model = undefined; this.llama = undefined; this.module = undefined; }
}
