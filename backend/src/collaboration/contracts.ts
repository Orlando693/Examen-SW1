import type { ProjectResource } from '@examen-sw1/uml-core';

export type CollaborationAccess = 'OWNER' | 'EDITOR';
export type CollaborationAction = 'NONE' | 'RESYNC' | 'REAUTHENTICATE' | 'LEAVE';
export type CollaborationErrorCode = 'AUTHENTICATION_REQUIRED' | 'AUTH_EXPIRED' | 'PROJECT_NOT_FOUND' | 'PROJECT_NOT_JOINED' | 'INVALID_COMMAND' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INTERNAL_ERROR';

export interface CollaborationError {
  ok: false;
  error: { code: CollaborationErrorCode; message: string };
  action: CollaborationAction;
}

export interface ParticipantPresence {
  userId: string;
  email: string;
  accessLevel: CollaborationAccess;
  initials: string;
  online: boolean;
  lastActivityAt: string | null;
  cursor: { x: number; y: number } | null;
  selectionIds: string[];
  editingElementId: string | null;
  activity: 'idle' | 'selecting' | 'editing' | 'dragging' | null;
}

export interface CollaborationSnapshot {
  projectId: string;
  resource: ProjectResource;
  sessionId: string;
  realtimeVersion: number;
  accessLevel: CollaborationAccess;
  documentDigest: null;
  participants: ParticipantPresence[];
}

export type CollaborationAck<T> = { ok: true; data: T } | CollaborationError;

export interface PresenceInput {
  cursor: { x: number; y: number } | null;
  selectionIds: string[];
  editingElementId: string | null;
  activity: 'idle' | 'selecting' | 'editing' | 'dragging' | null;
}

export const collaborationRoom = (projectId: string) => `project:${projectId}`;
