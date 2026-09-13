export const PRESENCE_RATE_PER_SECOND = 30;
export const PRESENCE_BURST_CAPACITY = 5;

interface Bucket { tokens: number; lastRefillAt: number; }

@Injectable()
export class PresenceRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  allow(socketId: string, now: number): boolean {
    const bucket = this.buckets.get(socketId) ?? { tokens: PRESENCE_BURST_CAPACITY, lastRefillAt: now };
    const elapsedSeconds = Math.max(0, now - bucket.lastRefillAt) / 1_000;
    bucket.tokens = Math.min(PRESENCE_BURST_CAPACITY, bucket.tokens + elapsedSeconds * PRESENCE_RATE_PER_SECOND);
    bucket.lastRefillAt = now;
    if (bucket.tokens < 1) { this.buckets.set(socketId, bucket); return false; }
    bucket.tokens -= 1; this.buckets.set(socketId, bucket); return true;
  }

  remove(socketId: string): void { this.buckets.delete(socketId); }
}
import { Injectable } from '@nestjs/common';
