import { randomUUID } from 'node:crypto';
import { createProjectDocument, type ProjectResource, UmlCommandBus } from '@examen-sw1/uml-core';
import type { LocalLlmResult } from '@examen-sw1/local-llm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SafeUser } from '../auth/users.repository.js';
import { ProjectApiError } from '../projects/project.errors.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AssistantService, type LocalAssistantInterpreter } from './assistant.service.js';

const user: SafeUser = { id: randomUUID(), email: 'assistant@example.com' };
const project = createProjectDocument({ id: randomUUID(), ownerId: user.id, name: 'Assistant test project', now: '2026-09-18T00:00:00.000Z' });
const resource: ProjectResource = { project, storageVersion: 0, documentSchemaVersion: 1 };

describe('AssistantService', () => {
  const get = vi.fn<(user: SafeUser, id: string) => Promise<ProjectResource>>();
  const interpret = vi.fn<LocalAssistantInterpreter['interpret']>();
  let service: AssistantService;

  beforeEach(() => {
    get.mockReset();
    interpret.mockReset();
    get.mockResolvedValue(resource);
    service = new AssistantService({ get } as unknown as ProjectsService, { interpret });
  });

  it('returns an immutable validated preview and never dispatches a UML command', async () => {
    const snapshot = structuredClone(resource.project);
    const dispatch = vi.spyOn(UmlCommandBus.prototype, 'execute');
    const result: LocalLlmResult = { ok: true, candidate: { version: 1, operation: 'create_class', name: 'Customer' }, raw: '{"version":1,"operation":"create_class","name":"Customer"}' };
    interpret.mockResolvedValue(result);

    await expect(service.interpret(user, project.id, { text: 'Create Customer' })).resolves.toMatchObject({
      status: 'success',
      candidate: result.candidate,
      preview: { command: { operation: 'create_class', name: 'Customer' }, contextRevision: project.revision },
      diagnostics: [],
    });
    expect(resource.project).toEqual(snapshot);
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it('returns an explicit clarification instead of selecting an ambiguous target', async () => {
    const ambiguous = structuredClone(resource);
    ambiguous.project.model.classes = [
      { id: randomUUID(), name: 'Customer', attributes: [], operations: [] },
      { id: randomUUID(), name: 'Customer', attributes: [], operations: [] },
    ];
    get.mockResolvedValue(ambiguous);
    interpret.mockResolvedValue({ ok: true, candidate: { version: 1, operation: 'rename_class', class: { name: 'Customer' }, name: 'Client' }, raw: '{}' });

    await expect(service.interpret(user, project.id, { text: 'Rename Customer to Client' })).resolves.toMatchObject({
      status: 'success',
      clarification: { operation: 'needs_clarification', candidates: [{ name: 'Customer', kind: 'class' }, { name: 'Customer', kind: 'class' }] },
      diagnostics: [{ code: 'AMBIGUOUS_REFERENCE' }],
    });
  });

  it('preserves project-access denial before calling the local interpreter', async () => {
    const denied = new ProjectApiError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
    get.mockRejectedValue(denied);

    await expect(service.interpret(user, project.id, { text: 'Create Customer' })).rejects.toBe(denied);
    expect(interpret).not.toHaveBeenCalled();
  });

  it.each([
    ['model_unavailable', 'MODEL_UNAVAILABLE'],
    ['invalid', 'INVALID_SCHEMA'],
    ['cancelled', 'GENERATION_CANCELLED'],
    ['timeout', 'GENERATION_TIMEOUT'],
  ] as const)('fails closed for %s results', async (status, code) => {
    interpret.mockResolvedValue({ ok: false, diagnostics: [{ code, message: 'Provider failure', path: '$' }] });

    await expect(service.interpret(user, project.id, { text: 'Create Customer', timeoutMs: 20 })).resolves.toEqual({
      status,
      diagnostics: [{ code, message: 'Provider failure', path: '$' }],
    });
  });

  it('forwards request cancellation to the provider without changing the project', async () => {
    const controller = new AbortController();
    controller.abort();
    const snapshot = structuredClone(resource.project);
    interpret.mockImplementation(async (input) => {
      expect(input.signal?.aborted).toBe(true);
      return { ok: false, diagnostics: [{ code: 'GENERATION_CANCELLED', message: 'Cancelled', path: '$' }] };
    });

    await expect(service.interpret(user, project.id, { text: 'Create Customer' }, controller.signal)).resolves.toMatchObject({ status: 'cancelled' });
    expect(resource.project).toEqual(snapshot);
  });

  it('forwards presentation chunks while remaining read-only', async () => {
    const snapshot = structuredClone(resource.project);
    const chunks: string[] = [];
    interpret.mockImplementation(async (input) => {
      input.onPresentationChunk?.('Interpreting... ');
      input.onPresentationChunk?.('Validating...');
      return { ok: true, candidate: { version: 1, operation: 'create_class', name: 'Customer' }, raw: '{}' };
    });

    await expect(service.interpret(user, project.id, { text: 'Create Customer' }, undefined, (chunk) => chunks.push(chunk))).resolves.toMatchObject({ status: 'success' });
    expect(chunks).toEqual(['Interpreting... ', 'Validating...']);
    expect(resource.project).toEqual(snapshot);
  });
});
