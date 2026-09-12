import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationAcceptClient } from './InvitationAcceptClient';
import { getInvitationToken } from '../../lib/invitations/invitation-continuation';

const mocks = vi.hoisted(() => {
  class InvitationApiError extends Error { constructor(public readonly code: string, message: string) { super(message); } }
  return { restore: vi.fn(), inspect: vi.fn(), reject: vi.fn(), accept: vi.fn(), InvitationApiError };
});
vi.mock('../../lib/auth/auth-session', () => ({ authApi: { restore: mocks.restore } }));
vi.mock('../../lib/invitations/invitation-api', () => ({ InvitationApiError: mocks.InvitationApiError, invitationApi: { inspect: mocks.inspect, reject: mocks.reject, accept: mocks.accept } }));

describe('InvitationAcceptClient', () => {
  beforeEach(() => { window.sessionStorage.clear(); window.history.replaceState(null, '', '/invitations/accept#token=fragment-secret'); mocks.restore.mockReset().mockResolvedValue({ accessToken: 'token', user: { id: 'id', email: 'recipient@example.com' } }); mocks.inspect.mockReset().mockResolvedValue({ invitation: { status: 'PENDING', expiresAt: '2026-09-19T00:00:00.000Z', role: 'EDITOR' } }); mocks.reject.mockReset(); mocks.accept.mockReset(); });
  afterEach(() => vi.restoreAllMocks());
  it('removes the fragment, inspects with the transient token, and clears it after a terminal response', async () => {
    mocks.reject.mockRejectedValue(new mocks.InvitationApiError('INVITATION_REVOKED', 'The invitation was revoked.'));
    render(<InvitationAcceptClient />);
    expect(await screen.findByRole('button', { name: 'Reject' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.inspect).toHaveBeenCalledWith('fragment-secret'));
    expect(window.location.hash).toBe('');
    expect(getInvitationToken()).toBe('fragment-secret');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('The invitation was revoked.')).toBeInTheDocument();
    expect(getInvitationToken()).toBeNull();
  });
});
