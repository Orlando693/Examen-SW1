import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectApiError, projectApi } from './project-api';
import { clearAuthSession, getAuthSession, setAuthSession } from '../auth/auth-session';

describe('Spring generation project API', () => {
  afterEach(() => { clearAuthSession(); vi.unstubAllGlobals(); });

  it('posts only the encoded project path with bearer auth and returns the ZIP Blob and safe filename', async () => {
    setAuthSession({ accessToken: 'token', user: { id: 'user-id', email: 'person@example.com' } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['zip']), { status: 200, headers: { 'content-disposition': 'attachment; filename="pedidos-abc123.zip"', 'content-type': 'application/zip' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await projectApi.generateSpring('project/a');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/projects/project%2Fa/generations/spring', { method: 'POST', headers: { authorization: 'Bearer token' } });
    expect(result).toMatchObject({ filename: 'pedidos-abc123.zip' });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('uses a safe fallback filename and maps bounded failures without retaining an unauthorized session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(new Blob(['zip']), { status: 200, headers: { 'content-disposition': 'attachment; filename="../unsafe.zip"' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'GENERATION_VALIDATION_FAILED', message: 'The saved UML model cannot be generated.', details: {} } }), { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(projectApi.generateSpring('project')).resolves.toMatchObject({ filename: 'spring-backend.zip' });
    await expect(projectApi.generateSpring('project')).rejects.toMatchObject({ code: 'GENERATION_VALIDATION_FAILED', message: 'The saved UML model cannot be generated.' } satisfies Partial<ProjectApiError>);

    setAuthSession({ accessToken: 'token', user: { id: 'user-id', email: 'person@example.com' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.', details: {} } }), { status: 401 })));
    await expect(projectApi.generateSpring('project')).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    expect(getAuthSession()).toBeNull();
  });
});
