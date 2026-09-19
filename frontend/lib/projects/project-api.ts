import {
  decodeProjectResource,
  type ProjectResource,
  type StructuralDiagnostic,
} from '@examen-sw1/uml-core';
import { decodeAssistantCommand, type AssistantCommand, type AssistantDiagnostic, type NeedsClarificationCommand } from '@examen-sw1/assistant-core';
import { clearAuthSession, getAuthSession } from '../auth/auth-session';

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  storageVersion: number;
  createdAt: string;
  updatedAt: string;
  access: 'OWNER' | 'EDITOR';
}

export interface ProjectApiErrorDetails {
  [key: string]: unknown;
}

export class ProjectApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: ProjectApiErrorDetails = {},
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ProjectApiError';
  }
}

export interface SaveProjectDocumentRequest {
  baseStorageVersion: number;
  document: Pick<ProjectResource['project'], 'revision' | 'model' | 'layout'>;
}

export interface UpdateProjectMetadataRequest {
  baseStorageVersion: number;
  name?: string;
  description?: string | null;
}

export type AssistantInterpretation = {
  status: 'success' | 'model_unavailable' | 'cancelled' | 'timeout' | 'invalid';
  candidate?: AssistantCommand;
  clarification?: NeedsClarificationCommand;
  diagnostics: AssistantDiagnostic[];
};

const DEFAULT_API_BASE_URL = 'http://localhost:3001';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeSummary(value: unknown, path: string): ProjectSummary {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || (value.description !== null && typeof value.description !== 'string') || typeof value.storageVersion !== 'number' || !Number.isInteger(value.storageVersion) || value.storageVersion < 0 || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' || (value.access !== 'OWNER' && value.access !== 'EDITOR')) {
    throw new ProjectApiError('INVALID_API_RESPONSE', `Invalid project summary at ${path}.`);
  }
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    storageVersion: value.storageVersion,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    access: value.access,
  };
}

function decodeResource(value: unknown): ProjectResource {
  const result = decodeProjectResource(value);
  if (!result.ok) {
    throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an invalid project resource.', { diagnostics: result.diagnostics satisfies StructuralDiagnostic[] });
  }
  return result.value;
}

function decodeAssistantDiagnostic(value: unknown, path: string): AssistantDiagnostic {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string' || typeof value.path !== 'string') {
    throw new ProjectApiError('INVALID_API_RESPONSE', `Invalid assistant diagnostic at ${path}.`);
  }
  return { code: value.code, message: value.message, path: value.path };
}

function decodeAssistantInterpretation(value: unknown): AssistantInterpretation {
  if (!isRecord(value) || !['success', 'model_unavailable', 'cancelled', 'timeout', 'invalid'].includes(value.status as string) || !Array.isArray(value.diagnostics)) {
    throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an invalid assistant interpretation.');
  }
  const diagnostics = value.diagnostics.map((item, index) => decodeAssistantDiagnostic(item, `diagnostics[${index}]`));
  const clarification = value.clarification === undefined ? undefined : decodeClarification(value.clarification);
  if (value.candidate === undefined) return { status: value.status as AssistantInterpretation['status'], ...(clarification === undefined ? {} : { clarification }), diagnostics };
  const candidate = decodeAssistantCommand(value.candidate);
  if (!candidate.ok) throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an unsafe assistant candidate.', { diagnostics: candidate.diagnostics });
  return { status: value.status as AssistantInterpretation['status'], candidate: candidate.command, ...(clarification === undefined ? {} : { clarification }), diagnostics };
}

function decodeClarification(value: unknown): NeedsClarificationCommand {
  if (!isRecord(value) || value.version !== 1 || value.operation !== 'needs_clarification' || !Array.isArray(value.candidates) || value.candidates.length > 128) {
    throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an invalid assistant clarification.');
  }
  const candidates = value.candidates.map((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !['class', 'attribute', 'relationship'].includes(candidate.kind as string)) {
      throw new ProjectApiError('INVALID_API_RESPONSE', `Invalid assistant clarification candidate at candidates[${index}].`);
    }
    return { id: candidate.id, name: candidate.name, kind: candidate.kind as 'class' | 'attribute' | 'relationship' };
  });
  return { version: 1, operation: 'needs_clarification', candidates };
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    const session = getAuthSession();
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}), ...init?.headers },
    });
  } catch {
    throw new ProjectApiError('NETWORK_ERROR', 'Unable to reach the project service.');
  }

  if (response.status === 204) return undefined;
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401) clearAuthSession();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string' && typeof body.error.message === 'string') {
      throw new ProjectApiError(body.error.code, body.error.message, isRecord(body.error.details) ? body.error.details : {}, response.status);
    }
    throw new ProjectApiError('HTTP_ERROR', `Project request failed (${response.status}).`, {}, response.status);
  }
  return body;
}

async function streamAssistantInterpretation(id: string, input: { text: string }, signal: AbortSignal | undefined, onChunk: (chunk: string) => void): Promise<AssistantInterpretation> {
  let response: Response;
  try {
    const session = getAuthSession();
    response = await fetch(`${apiBaseUrl()}/projects/${encodeURIComponent(id)}/assistant/interpret/stream`, {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
      headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}) },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ProjectApiError('NETWORK_ERROR', 'Unable to reach the project service.');
  }
  if (!response.ok || response.body === null) {
    const body: unknown = await response.json().catch(() => undefined);
    if (response.status === 401) clearAuthSession();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string' && typeof body.error.message === 'string') throw new ProjectApiError(body.error.code, body.error.message, isRecord(body.error.details) ? body.error.details : {}, response.status);
    throw new ProjectApiError('HTTP_ERROR', `Project request failed (${response.status}).`, {}, response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: AssistantInterpretation | undefined;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';
    for (const event of events) {
      const type = event.match(/^event: (.+)$/m)?.[1];
      const data = event.match(/^data: (.+)$/m)?.[1];
      if (data === undefined) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(data); } catch { throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an invalid assistant stream event.'); }
      if (type === 'chunk') {
        if (!isRecord(parsed) || typeof parsed.text !== 'string') throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an invalid assistant stream chunk.');
        onChunk(parsed.text);
      } else if (type === 'final') final = decodeAssistantInterpretation(parsed);
    }
    if (done) break;
  }
  if (final === undefined) throw new ProjectApiError('INVALID_API_RESPONSE', 'The assistant stream ended without a final interpretation.');
  return final;
}

export const projectApi = {
  async list(): Promise<ProjectSummary[]> {
    const value = await request('/projects');
    if (!isRecord(value) || !Array.isArray(value.items)) throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an invalid project list.');
    return value.items.map((item, index) => decodeSummary(item, `items[${index}]`));
  },
  async create(input: { name: string; description?: string | null }): Promise<ProjectResource> {
    return decodeResource(await request('/projects', { method: 'POST', body: JSON.stringify(input) }));
  },
  async get(id: string): Promise<ProjectResource> {
    return decodeResource(await request(`/projects/${encodeURIComponent(id)}`));
  },
  async saveDocument(id: string, input: SaveProjectDocumentRequest): Promise<ProjectResource> {
    return decodeResource(await request(`/projects/${encodeURIComponent(id)}/document`, { method: 'PUT', body: JSON.stringify(input) }));
  },
  async updateMetadata(id: string, input: UpdateProjectMetadataRequest): Promise<ProjectResource> {
    return decodeResource(await request(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }));
  },
  async delete(id: string, baseStorageVersion: number): Promise<void> {
    await request(`/projects/${encodeURIComponent(id)}?baseStorageVersion=${baseStorageVersion}`, { method: 'DELETE' });
  },
  async interpretAssistant(id: string, input: { text: string }, signal?: AbortSignal): Promise<AssistantInterpretation> {
    return decodeAssistantInterpretation(await request(`/projects/${encodeURIComponent(id)}/assistant/interpret`, { method: 'POST', body: JSON.stringify(input), signal }));
  },
  interpretAssistantStream(id: string, input: { text: string }, signal: AbortSignal | undefined, onChunk: (chunk: string) => void): Promise<AssistantInterpretation> {
    return streamAssistantInterpretation(id, input, signal, onChunk);
  },
};
