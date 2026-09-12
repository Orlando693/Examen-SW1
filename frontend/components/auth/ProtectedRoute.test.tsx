import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

const restore = vi.hoisted(() => vi.fn());

vi.mock('../../lib/auth/auth-session', () => ({
  authApi: { restore },
  safeReturnPath: (value: string) => value,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    restore.mockReset();
  });

  it('renders children only after an authenticated session restores', async () => {
    restore.mockResolvedValue({ accessToken: 'token', user: { id: 'user', email: 'user@example.com' } });
    render(<ProtectedRoute returnTo="/editor"><div>Protected editor</div></ProtectedRoute>);
    expect(await screen.findByText('Protected editor')).toBeInTheDocument();
  });

  it('does not render protected content when session restoration rejects access', async () => {
    restore.mockResolvedValue(null);
    render(<ProtectedRoute returnTo="/"><div>Projects</div></ProtectedRoute>);
    await Promise.resolve();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });
});
