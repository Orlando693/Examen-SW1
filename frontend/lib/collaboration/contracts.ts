import type { ProjectResource } from '@examen-sw1/uml-core';

export type CollaborationConnectionState = 'connecting' | 'joining' | 'connected' | 'resyncing' | 'disconnected' | 'auth-required' | 'error';

export interface CollaborationParticipant {
  userId: string;
  email: string;
  accessLevel: 'OWNER' | 'EDITOR';
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
  accessLevel: 'OWNER' | 'EDITOR';
  documentDigest: string | null;
  participants: CollaborationParticipant[];
}

export interface SequenceTaggedEvent { projectId: string; sessionId: string; realtimeVersion: number; }

export type CollaborationAction = 'NONE' | 'RESYNC' | 'REAUTHENTICATE' | 'LEAVE';
export interface CollaborationError { ok: false; error: { code: string; message: string }; action: CollaborationAction; }
export type CollaborationAck<T> = { ok: true; data: T } | CollaborationError;
export interface PresenceInput { cursor: { x: number; y: number } | null; selectionIds: string[]; editingElementId: string | null; activity: 'idle' | 'selecting' | 'editing' | 'dragging' | null; }
