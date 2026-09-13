import { describe, expect, it } from 'vitest';
import { PRESENCE_BURST_CAPACITY, PresenceRateLimiter } from './presence-rate-limiter.js';

describe('PresenceRateLimiter', () => {
  it('bounds and refills independent per-socket buckets', () => {
    const limiter = new PresenceRateLimiter();
    for (let index = 0; index < PRESENCE_BURST_CAPACITY; index += 1) expect(limiter.allow('socket-1', 0)).toBe(true);
    expect(limiter.allow('socket-1', 0)).toBe(false);
    expect(limiter.allow('socket-2', 0)).toBe(true);
    expect(limiter.allow('socket-1', 1_000)).toBe(true);
  });

  it('removes a socket bucket without affecting another socket', () => {
    const limiter = new PresenceRateLimiter();
    for (let index = 0; index < PRESENCE_BURST_CAPACITY; index += 1) limiter.allow('socket-1', 0);
    limiter.allow('socket-2', 0); limiter.remove('socket-1'); limiter.remove('socket-1');
    expect(limiter.allow('socket-1', 0)).toBe(true); expect(limiter.allow('socket-2', 0)).toBe(true);
  });
});
