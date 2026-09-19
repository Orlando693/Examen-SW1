import { createProjectDocument } from '@examen-sw1/uml-core';
import { createAssistantModelContext } from '@examen-sw1/assistant-core';
import { describe, expect, it } from 'vitest';
import { DeterministicAssistantProvider } from './deterministic-assistant.provider.js';

describe('DeterministicAssistantProvider', () => {
  it('emits controlled presentation chunks before its decoded candidate', async () => {
    const project = createProjectDocument({ id: '00000000-0000-4000-8000-000000000001', ownerId: '00000000-0000-4000-8000-000000000002', name: 'Fixture project', now: '2026-09-18T00:00:00.000Z' });
    const chunks: string[] = [];

    const result = await new DeterministicAssistantProvider().interpret({ text: 'create class Cliente', context: createAssistantModelContext(project), onPresentationChunk: (chunk) => chunks.push(chunk) });

    expect(chunks).toEqual(['Interpreting request... ', 'Validating UML context... ', 'Preparing safe proposal...']);
    expect(result).toMatchObject({ ok: true, candidate: { operation: 'create_class', name: 'Cliente' } });
  });

  it('stops presentation when the stream is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const project = createProjectDocument({ id: '00000000-0000-4000-8000-000000000001', ownerId: '00000000-0000-4000-8000-000000000002', name: 'Fixture project', now: '2026-09-18T00:00:00.000Z' });
    const chunks: string[] = [];
    const result = await new DeterministicAssistantProvider().interpret({ text: 'delayed cancellable', context: createAssistantModelContext(project), signal: controller.signal, onPresentationChunk: (chunk) => chunks.push(chunk) });

    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED' }] });
    expect(chunks).toEqual([]);
  });
});
