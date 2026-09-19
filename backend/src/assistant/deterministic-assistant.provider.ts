import { RuleBasedAssistantProvider, decodeAssistantCommand, type AssistantModelContext } from '@examen-sw1/assistant-core';
import type { LocalLlmResult } from '@examen-sw1/local-llm';
import type { LocalAssistantInterpreter } from './assistant.service.js';

const ruleBased = new RuleBasedAssistantProvider();

function result(value: unknown): LocalLlmResult {
  const decoded = decodeAssistantCommand(value);
  return decoded.ok
    ? { ok: true, candidate: decoded.command, raw: JSON.stringify(value) }
    : { ok: false, diagnostics: decoded.diagnostics };
}

function cancelled(signal: AbortSignal): Promise<LocalLlmResult> {
  return new Promise((resolve) => {
    const onAbort = () => resolve({ ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED', message: 'Deterministic generation was cancelled.', path: '$' }] });
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

function nextPresentationTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function holdFinalForStreamingEvidence(): Promise<void> {
  // E2E-only protocol boundary: lets the browser observe presentation chunks before final data.
  return new Promise((resolve) => setTimeout(resolve, 100));
}

/** E2E-only scripted provider. It deliberately never loads a local model. */
export class DeterministicAssistantProvider implements LocalAssistantInterpreter {
  async interpret(input: { text: string; context: AssistantModelContext; signal?: AbortSignal; onPresentationChunk?: (chunk: string) => void }): Promise<LocalLlmResult> {
    if (input.text === 'delayed cancellable') return cancelled(input.signal ?? new AbortController().signal);
    if (input.signal?.aborted) return { ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED', message: 'Deterministic generation was cancelled.', path: '$' }] };
    for (const chunk of ['Interpreting request... ', 'Validating UML context... ', 'Preparing safe proposal...']) {
      input.onPresentationChunk?.(chunk);
      await nextPresentationTurn();
      if (input.signal?.aborted) return { ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED', message: 'Deterministic generation was cancelled.', path: '$' }] };
    }
    await holdFinalForStreamingEvidence();
    if (input.signal?.aborted) return { ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED', message: 'Deterministic generation was cancelled.', path: '$' }] };
    if (input.text === 'delete fixture class') return result({ version: 1, operation: 'delete_class', class: { name: 'Fixture' } });
    if (input.text === 'ambiguity candidates') return result({ version: 1, operation: 'rename_class', class: { name: 'Duplicada' }, name: 'Resolved' });
    if (input.text === 'invalid intent') return result({ version: 1, operation: 'unsupported' });
    return result(await ruleBased.interpret(input));
  }
}
