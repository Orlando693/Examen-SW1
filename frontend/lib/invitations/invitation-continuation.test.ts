import { afterEach, describe, expect, it } from 'vitest';
import { clearInvitationToken, getInvitationToken, invitationContinuationPath, setInvitationToken } from './invitation-continuation';

describe('invitation continuation', () => {
  afterEach(() => window.sessionStorage.clear());
  it('keeps the raw token only in transient same-tab session storage and clears it', () => {
    setInvitationToken('raw-fragment-token');
    expect(getInvitationToken()).toBe('raw-fragment-token');
    expect(window.localStorage.getItem('examen-sw1.invitation-token')).toBeNull();
    clearInvitationToken();
    expect(getInvitationToken()).toBeNull();
  });

  it('continues login or registration through the acceptance route when a token is pending', () => {
    expect(invitationContinuationPath(true, '/editor')).toBe('/invitations/accept');
    expect(invitationContinuationPath(false, '/editor')).toBe('/editor');
  });
});
