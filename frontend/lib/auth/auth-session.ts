'use client';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export class AuthApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

const SESSION_KEY = 'examen-sw1.auth-session';
const DEFAULT_API_BASE_URL = 'http://localhost:3001';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function isUser(value: unknown): value is AuthUser {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'email' in value && typeof value.email === 'string';
}

function isSession(value: unknown): value is AuthSession {
  return typeof value === 'object' && value !== null && 'accessToken' in value && typeof value.accessToken === 'string' && 'user' in value && isUser(value.user);
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? 'null');
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(SESSION_KEY);
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

async function request(path: string, init: RequestInit = {}, authenticated = false): Promise<unknown> {
  const session = getAuthSession();
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (authenticated && session) headers.set('authorization', `Bearer ${session.accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
  } catch {
    throw new AuthApiError('NETWORK_ERROR', 'Unable to reach the authentication service.');
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.status === 401) clearAuthSession();
  if (!response.ok) {
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null && 'code' in body.error && typeof body.error.code === 'string' && 'message' in body.error && typeof body.error.message === 'string') {
      throw new AuthApiError(body.error.code, body.error.message, response.status);
    }
    throw new AuthApiError('HTTP_ERROR', `Authentication request failed (${response.status}).`, response.status);
  }
  return body;
}

function decodeSession(value: unknown): AuthSession {
  if (!isSession(value)) throw new AuthApiError('INVALID_API_RESPONSE', 'The server returned an invalid authentication response.');
  return value;
}

export const authApi = {
  async register(input: { email: string; password: string }): Promise<AuthSession> {
    return decodeSession(await request('/auth/register', { method: 'POST', body: JSON.stringify(input) }));
  },
  async login(input: { email: string; password: string }): Promise<AuthSession> {
    return decodeSession(await request('/auth/login', { method: 'POST', body: JSON.stringify(input) }));
  },
  async me(): Promise<AuthUser> {
    const value = await request('/auth/me', {}, true);
    if (!isUser(value)) throw new AuthApiError('INVALID_API_RESPONSE', 'The server returned an invalid user response.');
    return value;
  },
  async restore(): Promise<AuthSession | null> {
    const session = getAuthSession();
    if (!session) return null;
    try {
      const user = await this.me();
      const restored = { ...session, user };
      setAuthSession(restored);
      return restored;
    } catch {
      clearAuthSession();
      return null;
    }
  },
  logout: clearAuthSession,
};
