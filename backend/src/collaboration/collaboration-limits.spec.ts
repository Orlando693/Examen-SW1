import { describe, expect, it } from 'vitest';
import { readCollaborationLimits } from './collaboration-limits.js';

describe('readCollaborationLimits', () => {
  it('uses finite secure defaults and the explicit local origin', () => {
    const limits = readCollaborationLimits({});
    expect(limits).toMatchObject({ payloadBytes: 1_048_576, commandRatePerSecond: 10, commandBurstCapacity: 10, presenceRatePerSecond: 30, presenceBurstCapacity: 5, commandStringLength: 256, presenceSelectionCapacity: 50, layoutUpdateCapacity: 1_000, joinBufferCapacity: 128, sessionCapacity: 512, dedupeCapacity: 512, dedupeTtlMs: 600_000, reconnectTtlMs: 5_000, allowedOrigins: ['http://localhost:3000'] });
  });

  it('rejects wildcard origins and non-positive limits', () => {
    expect(() => readCollaborationLimits({ FRONTEND_ORIGIN: '*' })).toThrow('FRONTEND_ORIGIN');
    expect(() => readCollaborationLimits({ COLLABORATION_DEDUPE_CAPACITY: '0' })).toThrow('COLLABORATION_DEDUPE_CAPACITY');
  });
});
