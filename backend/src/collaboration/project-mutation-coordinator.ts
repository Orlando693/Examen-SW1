import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectMutationCoordinator {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, number>();

  async run<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(projectId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    this.tails.set(projectId, previous.then(() => next));
    this.pending.set(projectId, (this.pending.get(projectId) ?? 0) + 1);
    await previous;
    try { return await operation(); } finally {
      release();
      const count = (this.pending.get(projectId) ?? 1) - 1;
      if (count === 0) this.pending.delete(projectId); else this.pending.set(projectId, count);
      if (this.tails.get(projectId) === next) this.tails.delete(projectId);
    }
  }

  isIdle(projectId: string): boolean { return !this.pending.has(projectId); }
}
