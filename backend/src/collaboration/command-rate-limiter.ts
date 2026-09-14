import { Injectable } from '@nestjs/common';
import { COLLABORATION_LIMITS } from './collaboration-limits.js';

interface Bucket { tokens: number; lastRefillAt: number; }

@Injectable()
export class CommandRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  allow(socketId: string, now: number): boolean {
    const bucket = this.buckets.get(socketId);
    if (!bucket && this.buckets.size >= COLLABORATION_LIMITS.rateBucketCapacity) return false;
    const current = bucket ?? { tokens: COLLABORATION_LIMITS.commandBurstCapacity, lastRefillAt: now };
    current.tokens = Math.min(COLLABORATION_LIMITS.commandBurstCapacity, current.tokens + Math.max(0, now - current.lastRefillAt) / 1_000 * COLLABORATION_LIMITS.commandRatePerSecond);
    current.lastRefillAt = now;
    if (current.tokens < 1) { this.buckets.set(socketId, current); return false; }
    current.tokens -= 1; this.buckets.set(socketId, current); return true;
  }

  remove(socketId: string): void { this.buckets.delete(socketId); }
  get size(): number { return this.buckets.size; }
}
