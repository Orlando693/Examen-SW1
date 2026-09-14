import { describe, expect, it } from 'vitest';
import { COLLABORATION_LIMITS } from './collaboration-limits.js';
import { CommandRateLimiter } from './command-rate-limiter.js';

describe('CommandRateLimiter', () => {
  it('bounds a socket burst, refills it, and releases its state', () => {
    const limiter = new CommandRateLimiter();
    for (let index = 0; index < COLLABORATION_LIMITS.commandBurstCapacity; index += 1) expect(limiter.allow('socket-a', 0)).toBe(true);
    expect(limiter.allow('socket-a', 0)).toBe(false);
    expect(limiter.allow('socket-a', 1_000)).toBe(true);
    limiter.remove('socket-a');
    expect(limiter.size).toBe(0);
  });
});
