export const CURSOR_PUBLISH_HZ = 20;
export const CURSOR_PUBLISH_INTERVAL_MS = 1_000 / CURSOR_PUBLISH_HZ;

export type FlowCursor = { x: number; y: number } | null;

interface CursorScheduler {
  now(): number;
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const browserScheduler: CursorScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle),
};

export class CursorPresencePublisher {
  private lastPublishedAt = Number.NEGATIVE_INFINITY;
  private pendingCursor: FlowCursor = null;
  private hasPending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly send: (cursor: FlowCursor) => void, private readonly scheduler: CursorScheduler = browserScheduler) {}

  publish(cursor: FlowCursor): void {
    if (this.disposed) return;
    const now = this.scheduler.now();
    if (this.timer === null && now - this.lastPublishedAt >= CURSOR_PUBLISH_INTERVAL_MS) {
      this.send(cursor); this.lastPublishedAt = now;
      return;
    }
    this.pendingCursor = cursor; this.hasPending = true;
    if (this.timer === null) this.timer = this.scheduler.setTimeout(() => this.flush(), Math.max(0, CURSOR_PUBLISH_INTERVAL_MS - (now - this.lastPublishedAt)));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.hasPending = false; this.pendingCursor = null;
    if (this.timer !== null) this.scheduler.clearTimeout(this.timer);
    this.timer = null;
  }

  private flush(): void {
    this.timer = null;
    if (this.disposed || !this.hasPending) return;
    const cursor = this.pendingCursor;
    this.hasPending = false; this.pendingCursor = null;
    this.send(cursor); this.lastPublishedAt = this.scheduler.now();
  }
}
