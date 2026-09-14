import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ProjectMutationCoordinator } from './project-mutation-coordinator.js';
import type { ProjectCommandApplied } from './project-command-applied.js';
import { readCollaborationLimits } from './collaboration-limits.js';

export class CollaborationCapacityError extends Error {}

export interface DedupeEntry {
  actorUserId: string;
  intentDigest: string;
  result: ProjectCommandApplied;
  createdAt: number;
}

export interface ProjectSession {
  projectId: string;
  generation: number;
  sessionId: string;
  realtimeVersion: number;
  socketIds: Set<string>;
  evictionTimer: NodeJS.Timeout | null;
  dedupe: Map<string, DedupeEntry>;
  poisoned: boolean;
}

@Injectable()
export class CollaborationSessionManager implements OnModuleDestroy {
  private readonly sessions = new Map<string, ProjectSession>();
  private generation = 0;
  private readonly limits = readCollaborationLimits();
  constructor(@Inject(ProjectMutationCoordinator) private readonly coordinator: ProjectMutationCoordinator) {}

  getOrCreate(projectId: string): ProjectSession {
    const existing = this.sessions.get(projectId);
    if (existing) return existing;
    if (this.sessions.size >= this.limits.sessionCapacity) throw new CollaborationCapacityError();
    const session: ProjectSession = { projectId, generation: ++this.generation, sessionId: randomUUID(), realtimeVersion: 0, socketIds: new Set(), evictionTimer: null, dedupe: new Map(), poisoned: false };
    this.sessions.set(projectId, session);
    return session;
  }

  join(projectId: string, socketId: string): ProjectSession {
    const session = this.getOrCreate(projectId);
    if (session.evictionTimer) { clearTimeout(session.evictionTimer); session.evictionTimer = null; }
    session.socketIds.add(socketId);
    return session;
  }

  leave(projectId: string, socketId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) return;
    session.socketIds.delete(socketId);
    if (session.socketIds.size || session.evictionTimer) return;
    const generation = session.generation;
    session.evictionTimer = setTimeout(() => {
      const current = this.sessions.get(projectId);
      if (current?.generation === generation && current.socketIds.size === 0 && this.coordinator.isIdle(projectId)) this.sessions.delete(projectId);
    }, this.limits.reconnectTtlMs);
  }

  get(projectId: string): ProjectSession | undefined { return this.sessions.get(projectId); }
  invalidate(projectId: string, sessionId: string): void {
    const session = this.sessions.get(projectId);
    if (!session || session.sessionId !== sessionId) return;
    session.poisoned = true;
    this.sessions.delete(projectId);
  }
  terminate(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) return;
    if (session.evictionTimer) clearTimeout(session.evictionTimer);
    session.evictionTimer = null;
    session.socketIds.clear();
    session.dedupe.clear();
    session.poisoned = true;
    this.sessions.delete(projectId);
  }
  onModuleDestroy(): void { for (const session of this.sessions.values()) if (session.evictionTimer) clearTimeout(session.evictionTimer); this.sessions.clear(); }
}
