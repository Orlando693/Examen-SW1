import { Injectable } from '@nestjs/common';
import type { ParticipantPresence, PresenceInput } from './contracts.js';

interface SocketPresence { userId: string; value: PresenceInput; lastActivityAt: number; }
interface Participant { userId: string; email: string; accessLevel: 'OWNER' | 'EDITOR'; }

function initials(email: string): string {
  return email.split('@')[0].split(/[._-]+/).filter(Boolean).map((part) => part[0]?.toUpperCase()).join('').slice(0, 2) || '?';
}

@Injectable()
export class PresenceRegistry {
  private readonly sockets = new Map<string, Map<string, SocketPresence>>();

  update(projectId: string, socketId: string, userId: string, value: PresenceInput): void {
    const project = this.sockets.get(projectId) ?? new Map<string, SocketPresence>();
    project.set(socketId, { userId, value, lastActivityAt: Date.now() });
    this.sockets.set(projectId, project);
  }

  remove(projectId: string, socketId: string): void {
    const project = this.sockets.get(projectId);
    if (!project) return;
    project.delete(socketId);
    if (project.size === 0) this.sockets.delete(projectId);
  }

  clear(projectId: string): void { this.sockets.delete(projectId); }

  roster(projectId: string, participants: Participant[]): ParticipantPresence[] {
    const states = this.sockets.get(projectId) ?? new Map<string, SocketPresence>();
    return participants.map((participant) => {
      const latest = [...states.values()].filter((state) => state.userId === participant.userId).sort((a, b) => b.lastActivityAt - a.lastActivityAt)[0];
      return {
        userId: participant.userId, email: participant.email, accessLevel: participant.accessLevel, initials: initials(participant.email), online: Boolean(latest),
        lastActivityAt: latest ? new Date(latest.lastActivityAt).toISOString() : null,
        cursor: latest?.value.cursor ?? null, selectionIds: latest?.value.selectionIds ?? [], editingElementId: latest?.value.editingElementId ?? null, activity: latest?.value.activity ?? null,
      };
    });
  }
}
