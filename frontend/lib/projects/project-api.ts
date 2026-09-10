import {
  decodeProjectResource,
  type ProjectResource,
  type StructuralDiagnostic,
} from '@examen-sw1/uml-core';
import { clearAuthSession, getAuthSession } from '../auth/auth-session';

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  storageVersion: number;
  createdAt: string;
  updatedAt: string;
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

const DEFAULT_API_BASE_URL = 'http://localhost:3001';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeSummary(value: unknown, path: string): ProjectSummary {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || (value.description !== null && typeof value.description !== 'string') || typeof value.storageVersion !== 'number' || !Number.isInteger(value.storageVersion) || value.storageVersion < 0 || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new ProjectApiError('INVALID_API_RESPONSE', `Invalid project summary at ${path}.`);
  }
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    storageVersion: value.storageVersion,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function decodeResource(value: unknown): ProjectResource {
  const result = decodeProjectResource(value);
  if (!result.ok) {
    throw new ProjectApiError('INVALID_API_RESPONSE', 'The server returned an invalid project resource.', { diagnostics: result.diagnostics satisfies StructuralDiagnostic[] });
  }
  return result.value;
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
};
