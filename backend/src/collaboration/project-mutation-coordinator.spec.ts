import { describe, expect, it } from 'vitest';
import { ProjectMutationCoordinator } from './project-mutation-coordinator.js';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe('ProjectMutationCoordinator', () => {
  it('releases a project queue after a failing operation', async () => {
    const coordinator = new ProjectMutationCoordinator();
    await expect(coordinator.run('project-a', async () => { throw new Error('expected failure'); })).rejects.toThrow('expected failure');
    await expect(coordinator.run('project-a', async () => 'after failure')).resolves.toBe('after failure');
    expect(coordinator.isIdle('project-a')).toBe(true);
  });

  it('does not block a different project behind a queued operation', async () => {
    const coordinator = new ProjectMutationCoordinator();
    const release = deferred();
    const queued = coordinator.run('project-a', () => release.promise);
    await expect(coordinator.run('project-b', async () => 'project-b')).resolves.toBe('project-b');
    release.resolve();
    await queued;
  });
});
