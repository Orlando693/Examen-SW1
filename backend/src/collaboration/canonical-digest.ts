import { createHash } from 'node:crypto';
import type { ProjectDocument, UmlCommand } from '@examen-sw1/uml-core';

export interface CanonicalCommandIntent {
  projectId: string;
  sessionId: string;
  actorUserId: string;
  baseRealtimeVersion: number;
  baseRevision: number;
  command: UmlCommand;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON requires finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value !== 'object') throw new TypeError('Canonical JSON rejects undefined and unsupported values.');
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function serializeCanonical(value: unknown): string { return canonicalJson(value); }
export function sha256Canonical(value: unknown): string { return createHash('sha256').update(serializeCanonical(value)).digest('hex'); }
export function digestCommandIntent(intent: CanonicalCommandIntent): string { return sha256Canonical(intent); }
export function digestProjectDocument(document: ProjectDocument): string { return sha256Canonical(document); }
