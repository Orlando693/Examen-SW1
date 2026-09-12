import { clearAuthSession, getAuthSession } from '../auth/auth-session';

export interface Invitation {
  id: string;
  invitedEmail: string;
  role: 'EDITOR';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  revokedAt: string | null;
}

export class InvitationApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message);
    this.name = 'InvitationApiError';
  }
}

const apiBaseUrl = () => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const session = getAuthSession();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}), ...init.headers } });
  } catch {
    throw new InvitationApiError('NETWORK_ERROR', 'Unable to reach the invitation service.');
  }
  if (response.status === 204) return undefined;
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401) clearAuthSession();
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null && 'code' in body.error && typeof body.error.code === 'string' && 'message' in body.error && typeof body.error.message === 'string') throw new InvitationApiError(body.error.code, body.error.message, response.status);
    throw new InvitationApiError('HTTP_ERROR', `Invitation request failed (${response.status}).`, response.status);
  }
  return body;
}

export const invitationApi = {
  async create(projectId: string, email: string): Promise<{ invitation: Invitation; acceptanceUrl: string }> { return request(`/projects/${encodeURIComponent(projectId)}/invitations`, { method: 'POST', body: JSON.stringify({ email }) }) as Promise<{ invitation: Invitation; acceptanceUrl: string }>; },
  async list(projectId: string): Promise<Invitation[]> { const result = await request(`/projects/${encodeURIComponent(projectId)}/invitations`) as { items: Invitation[] }; return result.items; },
  async revoke(projectId: string, invitationId: string): Promise<void> { await request(`/projects/${encodeURIComponent(projectId)}/invitations/${encodeURIComponent(invitationId)}/revoke`, { method: 'POST' }); },
  async inspect(token: string): Promise<{ invitation: Pick<Invitation, 'status' | 'expiresAt' | 'role'> }> { return request('/invitations/inspect', { method: 'POST', body: JSON.stringify({ token }) }) as Promise<{ invitation: Pick<Invitation, 'status' | 'expiresAt' | 'role'> }>; },
  async accept(token: string): Promise<void> { await request('/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) }); },
  async reject(token: string): Promise<void> { await request('/invitations/reject', { method: 'POST', body: JSON.stringify({ token }) }); },
};
