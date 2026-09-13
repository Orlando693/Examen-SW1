import { describe, expect, it } from 'vitest';
import type { ProjectResource, UmlCommand } from '@examen-sw1/uml-core';
import { normalizeRealtimeCommand } from './realtime-command-normalizer.js';

const classId = '123e4567-e89b-42d3-a456-426614174000'; const enumId = '223e4567-e89b-42d3-a456-426614174000'; const nodeId = '323e4567-e89b-42d3-a456-426614174000'; const generated = ['423e4567-e89b-42d3-a456-426614174000', '523e4567-e89b-42d3-a456-426614174000', '623e4567-e89b-42d3-a456-426614174000'];
const resource: ProjectResource = { storageVersion: 0, documentSchemaVersion: 1, project: { id: '723e4567-e89b-42d3-a456-426614174000', metadata: { name: 'P' }, revision: 0, timestamps: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }, model: { packages: [], classes: [{ id: classId, name: 'Class', attributes: [], operations: [] }], enumerations: [{ id: enumId, name: 'Enum', literals: [] }], relationships: [] }, layout: { nodes: [{ id: nodeId, elementId: classId, position: { x: 1, y: 2 } }] } } };
const context = { appliedAt: '2026-02-01T00:00:00.000Z', generatedIds: generated };
const commands: UmlCommand[] = [{ type: 'CreateClass', name: 'C' }, { type: 'DeleteClass', classId }, { type: 'RenameClass', classId, name: 'C' }, { type: 'CreateEnumeration', name: 'E' }, { type: 'RenameEnumeration', enumerationId: enumId, name: 'E' }, { type: 'DeleteEnumeration', enumerationId: enumId }, { type: 'AddEnumerationLiteral', enumerationId: enumId, name: 'L' }, { type: 'UpdateEnumerationLiteral', enumerationId: enumId, literalId: generated[0]!, name: 'L' }, { type: 'RemoveEnumerationLiteral', enumerationId: enumId, literalId: generated[0]! }, { type: 'AddAttribute', classId, name: 'a', attributeType: { kind: 'primitive', name: 'string' } }, { type: 'RemoveAttribute', classId, attributeId: generated[0]! }, { type: 'UpdateAttribute', classId, attributeId: generated[0]!, name: 'a' }, { type: 'CreateAssociation', sourceClassId: classId, targetClassId: classId }, { type: 'CreateGeneralization', sourceClassId: classId, targetClassId: classId }, { type: 'DeleteRelationship', relationshipId: generated[0]! }, { type: 'UpdateMultiplicity', relationshipId: generated[0]!, endpoint: 'source', multiplicity: { lower: 1, upper: 1 } }, { type: 'UpdateRelationship', relationshipId: generated[0]!, name: null }, { type: 'MoveNode', elementId: classId, position: { x: 3, y: 4 } }, { type: 'ApplyLayout', updates: [{ elementId: classId, position: { x: 5, y: 6 } }, { elementId: enumId, position: { x: 7, y: 8 } }] }];

describe('normalizeRealtimeCommand', () => {
  it.each(commands)('handles %s without mutating input or resource', (command) => { const before = JSON.stringify({ command, resource }); const result = normalizeRealtimeCommand(command, resource, context); expect(result.ok).toBe(true); expect(JSON.stringify({ command, resource })).toBe(before); if (result.ok) expect(result.data.appliedAt).toBe(context.appliedAt); });
  it('materializes optional ids and executor defaults deterministically', () => {
    const result = normalizeRealtimeCommand({ type: 'AddAttribute', classId, name: 'a', attributeType: { kind: 'primitive', name: 'string' } }, resource, context); expect(result).toMatchObject({ ok: true, data: { command: { attributeId: generated[0], visibility: 'private' } } }); expect(result).toEqual(normalizeRealtimeCommand({ type: 'AddAttribute', classId, name: 'a', attributeType: { kind: 'primitive', name: 'string' } }, resource, context));
  });
  it('preserves explicit ids, strips ignored existing layout ids, and materializes new layout ids in input order', () => {
    const explicit = normalizeRealtimeCommand({ type: 'CreateClass', classId: generated[0]!, name: 'C' }, resource, context); expect(explicit).toMatchObject({ ok: true, data: { command: { classId: generated[0] } } });
    const layout = normalizeRealtimeCommand({ type: 'ApplyLayout', updates: [{ elementId: classId, nodeId: generated[0]!, position: { x: 1, y: 2 } }, { elementId: enumId, position: { x: 3, y: 4 } }] }, resource, context); expect(layout).toMatchObject({ ok: true, data: { command: { updates: [{ elementId: classId }, { elementId: enumId, nodeId: generated[0] }] } } });
  });
  it('rejects collisions, unknown semantic targets, duplicate layout updates, and hidden timestamps', () => {
    expect(normalizeRealtimeCommand({ type: 'CreateClass', classId, name: 'C' }, resource, context).ok).toBe(false);
    expect(normalizeRealtimeCommand({ type: 'MoveNode', elementId: generated[0]!, position: { x: 1, y: 2 } }, resource, context).ok).toBe(false);
    expect(normalizeRealtimeCommand({ type: 'ApplyLayout', updates: [{ elementId: classId, position: { x: 1, y: 2 } }, { elementId: classId, position: { x: 3, y: 4 } }] }, resource, context).ok).toBe(false);
    expect(normalizeRealtimeCommand({ type: 'DeleteClass', classId }, resource, { ...context, appliedAt: 'invalid' }).ok).toBe(false);
  });
});
