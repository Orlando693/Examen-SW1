import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi, clearAuthSession, getAuthSession, safeReturnPath, setAuthSession } from './auth-session';

const session = { accessToken: 'token', user: { id: 'user-id', email: 'person@example.com' } };

describe('auth session', () => {
  afterEach(() => { window.sessionStorage.clear(); vi.restoreAllMocks(); });

  it('stores only in same-tab session storage and validates internal return paths', () => {
    setAuthSession(session);
    expect(getAuthSession()).toEqual(session);
    expect(window.localStorage.getItem('examen-sw1.auth-session')).toBeNull();
    expect(safeReturnPath('/editor?projectId=one')).toBe('/editor?projectId=one');
    expect(safeReturnPath('https://attacker.example')).toBe('/');
    expect(safeReturnPath('//attacker.example')).toBe('/');
    expect(safeReturnPath('javascript:alert(1)')).toBe('/');
  });

  it('restores a valid session and clears it after a 401 response', async () => {
    setAuthSession(session);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'user-id', email: 'person@example.com' }), { status: 200 })));
    await expect(authApi.restore()).resolves.toEqual(session);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.', details: {} } }), { status: 401 })));
    await expect(authApi.me()).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    expect(getAuthSession()).toBeNull();
  });

  it('clears a session locally without calling a logout endpoint', () => {
    setAuthSession(session);
    authApi.logout();
    expect(getAuthSession()).toBeNull();
    clearAuthSession();
  });
});
