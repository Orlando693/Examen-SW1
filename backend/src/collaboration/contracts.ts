import type { ProjectResource } from '@examen-sw1/uml-core';
import { createAuthoritativeResourceSnapshot } from './project-command-applied.js';
import type { ProjectCommandApplied } from './project-command-applied.js';

export type CollaborationAccess = 'OWNER' | 'EDITOR';
export type CollaborationAction = 'NONE' | 'RESYNC' | 'REAUTHENTICATE' | 'LEAVE';
export type CollaborationErrorCode = 'AUTHENTICATION_REQUIRED' | 'AUTH_EXPIRED' | 'PROJECT_NOT_FOUND' | 'PROJECT_NOT_JOINED' | 'INVALID_COMMAND' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'STALE_SESSION' | 'STALE_REALTIME_VERSION' | 'STALE_DOCUMENT_REVISION' | 'DOMAIN_COMMAND_REJECTED' | 'SEMANTIC_VALIDATION_FAILED' | 'CAS_CONFLICT' | 'INTERNAL_STATE_UNCERTAIN' | 'INTERNAL_ERROR';

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
  documentDigest: string | null;
  participants: ParticipantPresence[];
}

export type CollaborationAck<T> = { ok: true; data: T } | CollaborationError;

export type ProjectCommandAck =
  | { ok: true; status: 'APPLIED' | 'DUPLICATE'; data: ProjectCommandApplied }
  | CollaborationError;

export interface PresenceInput {
  cursor: { x: number; y: number } | null;
  selectionIds: string[];
  editingElementId: string | null;
  activity: 'idle' | 'selecting' | 'editing' | 'dragging' | null;
}

export const collaborationRoom = (projectId: string) => `project:${projectId}`;
export { createAuthoritativeResourceSnapshot };
