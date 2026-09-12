'use client';

const TOKEN_KEY = 'examen-sw1.invitation-token';

export function getInvitationToken(): string | null { return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY); }
export function setInvitationToken(token: string): void { window.sessionStorage.setItem(TOKEN_KEY, token); }
export function clearInvitationToken(): void { if (typeof window !== 'undefined') window.sessionStorage.removeItem(TOKEN_KEY); }

export function invitationContinuationPath(hasInvitationToken: boolean, returnTo: string): string {
  return hasInvitationToken ? '/invitations/accept' : returnTo;
}
