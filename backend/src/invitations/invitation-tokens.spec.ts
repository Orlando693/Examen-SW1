import { describe, expect, it } from 'vitest';
import { createInvitationToken, hashInvitationToken, invitationExpiry, invitationTokenMatches, INVITATION_TTL_MS } from './invitation-tokens.js';

describe('invitation tokens', () => {
  it('uses 32 random bytes encoded as base64url and stores only a SHA-256 hash', () => {
    const token = createInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashInvitationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInvitationToken(token)).not.toContain(token);
    expect(invitationTokenMatches(token, hashInvitationToken(token))).toBe(true);
    expect(invitationTokenMatches('different-token', hashInvitationToken(token))).toBe(false);
  });

  it('calculates the seven-day expiry from the supplied instant', () => {
    const now = new Date('2026-09-12T00:00:00.000Z');
    expect(invitationExpiry(now).getTime() - now.getTime()).toBe(INVITATION_TTL_MS);
  });
});
