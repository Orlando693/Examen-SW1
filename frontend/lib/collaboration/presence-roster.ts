import type { CollaborationParticipant } from './contracts';

export function avatarInitials(participant: Pick<CollaborationParticipant, 'email' | 'initials'>): string {
  if (participant.initials) return participant.initials;
  const localPart = participant.email.split('@')[0] ?? '';
  return localPart.split(/[._-]+/).filter(Boolean).map((part) => part[0]?.toUpperCase()).join('').slice(0, 2) || '?';
}

export function isPresenceRoster(value: unknown): value is CollaborationParticipant[] {
  return Array.isArray(value) && value.every((participant) => typeof participant === 'object' && participant !== null && 'userId' in participant && typeof participant.userId === 'string' && 'email' in participant && typeof participant.email === 'string' && 'initials' in participant && typeof participant.initials === 'string' && 'online' in participant && typeof participant.online === 'boolean');
}

export class PresenceRoster {
  private projectId: string | null = null;
  private participants = new Map<string, CollaborationParticipant>();

  replace(projectId: string, participants: CollaborationParticipant[]): CollaborationParticipant[] {
    this.projectId = projectId; this.participants = new Map(participants.map((participant) => [participant.userId, participant]));
    return this.values();
  }

  update(projectId: string, participants: CollaborationParticipant[]): CollaborationParticipant[] | null {
    if (projectId !== this.projectId) return null;
    this.participants = new Map(participants.map((participant) => [participant.userId, participant]));
    return this.values();
  }

  clear(): void { this.projectId = null; this.participants.clear(); }

  private values(): CollaborationParticipant[] { return [...this.participants.values()]; }
}
