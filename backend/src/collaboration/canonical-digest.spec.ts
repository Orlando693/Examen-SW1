import { describe, expect, it } from 'vitest';
import { digestCommandIntent, digestProjectDocument, serializeCanonical, sha256Canonical } from './canonical-digest.js';

const id = '123e4567-e89b-42d3-a456-426614174000';
const intent = { projectId: id, sessionId: '223e4567-e89b-42d3-a456-426614174000', actorUserId: '323e4567-e89b-42d3-a456-426614174000', baseRealtimeVersion: 0, baseRevision: 0, command: { type: 'RenameClass' as const, classId: id, name: 'Customer' } };
const document = { id, metadata: { name: 'Project' }, revision: 0, timestamps: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }, model: { packages: [], classes: [], enumerations: [], relationships: [] }, layout: { nodes: [] } };

describe('canonical digests', () => {
  it('sorts object keys while preserving array order', () => {
    expect(serializeCanonical({ b: 2, a: [2, 1] })).toBe('{"a":[2,1],"b":2}');
    expect(sha256Canonical({ a: 1, b: 2 })).toBe(sha256Canonical({ b: 2, a: 1 }));
    expect(sha256Canonical([1, 2])).not.toBe(sha256Canonical([2, 1]));
  });
  it('produces stable SHA-256 intent digests from semantic transport fields only', () => {
    expect(digestCommandIntent(intent)).toMatch(/^[0-9a-f]{64}$/);
    expect(digestCommandIntent(intent)).toBe(digestCommandIntent({ ...intent, command: { name: 'Customer', classId: id, type: 'RenameClass' } }));
    expect(digestCommandIntent(intent)).not.toBe(digestCommandIntent({ ...intent, command: { ...intent.command, name: 'Client' } }));
  });
  it('digests the authoritative ProjectDocument without mutation', () => {
    const before = JSON.stringify(document); expect(digestProjectDocument(document)).toBe(digestProjectDocument({ ...document, model: { ...document.model }, layout: { ...document.layout } })); expect(JSON.stringify(document)).toBe(before);
    expect(digestProjectDocument(document)).not.toBe(digestProjectDocument({ ...document, revision: 1 }));
  });
  it('rejects undefined and non-finite canonical values', () => {
    expect(() => serializeCanonical({ value: undefined })).toThrow(TypeError);
    expect(() => serializeCanonical({ value: Number.NaN })).toThrow(TypeError);
  });
});
