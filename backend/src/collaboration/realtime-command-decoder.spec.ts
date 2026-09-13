import { describe, expect, it } from 'vitest';
import { decodeRealtimeCommandEnvelope, MAX_REALTIME_COMMAND_STRING_LENGTH, MAX_REALTIME_LAYOUT_UPDATES } from './realtime-command-decoder.js';

const id = '123e4567-e89b-42d3-a456-426614174000';
const id2 = '223e4567-e89b-42d3-a456-426614174000';
const envelope = (command: unknown) => ({ projectId: id, sessionId: id2, commandId: '323e4567-e89b-42d3-a456-426614174000', baseRealtimeVersion: 0, baseRevision: 0, command });
const commands: Array<[string, Record<string, unknown>, string]> = [
  ['CreateClass', { type: 'CreateClass', name: 'Class' }, 'name'], ['DeleteClass', { type: 'DeleteClass', classId: id }, 'classId'], ['RenameClass', { type: 'RenameClass', classId: id, name: 'Class' }, 'classId'], ['CreateEnumeration', { type: 'CreateEnumeration', name: 'Enum' }, 'name'], ['RenameEnumeration', { type: 'RenameEnumeration', enumerationId: id, name: 'Enum' }, 'enumerationId'], ['DeleteEnumeration', { type: 'DeleteEnumeration', enumerationId: id }, 'enumerationId'], ['AddEnumerationLiteral', { type: 'AddEnumerationLiteral', enumerationId: id, name: 'Literal' }, 'enumerationId'], ['UpdateEnumerationLiteral', { type: 'UpdateEnumerationLiteral', enumerationId: id, literalId: id2, name: 'Literal' }, 'literalId'], ['RemoveEnumerationLiteral', { type: 'RemoveEnumerationLiteral', enumerationId: id, literalId: id2 }, 'literalId'], ['AddAttribute', { type: 'AddAttribute', classId: id, name: 'field', attributeType: { kind: 'primitive', name: 'string' } }, 'attributeType'], ['RemoveAttribute', { type: 'RemoveAttribute', classId: id, attributeId: id2 }, 'attributeId'], ['UpdateAttribute', { type: 'UpdateAttribute', classId: id, attributeId: id2, name: 'field' }, 'attributeId'], ['CreateAssociation', { type: 'CreateAssociation', sourceClassId: id, targetClassId: id2 }, 'sourceClassId'], ['CreateGeneralization', { type: 'CreateGeneralization', sourceClassId: id, targetClassId: id2 }, 'targetClassId'], ['DeleteRelationship', { type: 'DeleteRelationship', relationshipId: id }, 'relationshipId'], ['UpdateMultiplicity', { type: 'UpdateMultiplicity', relationshipId: id, endpoint: 'source', multiplicity: { lower: 0, upper: '*' } }, 'multiplicity'], ['UpdateRelationship', { type: 'UpdateRelationship', relationshipId: id, name: null }, 'relationshipId'], ['MoveNode', { type: 'MoveNode', elementId: id, position: { x: 1, y: 2 } }, 'position'], ['ApplyLayout', { type: 'ApplyLayout', updates: [{ elementId: id, position: { x: 1, y: 2 } }] }, 'updates'],
];

describe('decodeRealtimeCommandEnvelope', () => {
  it.each(commands)('strictly decodes %s and rejects required, typed, and extra payload fields', (_type, command, required) => {
    expect(decodeRealtimeCommandEnvelope(envelope(command)).ok).toBe(true);
    const missing = { ...command }; delete missing[required]; expect(decodeRealtimeCommandEnvelope(envelope(missing)).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ ...command, [required]: 1 })).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ ...command, revision: 9 })).ok).toBe(false);
  });
  it.each([null, [], 'command', {}, { projectId: 'bad' }, { projectId: id, sessionId: id2, commandId: id, baseRealtimeVersion: Number.NaN, baseRevision: 0, command: commands[0]![1] }, { projectId: id, sessionId: id2, commandId: id, baseRealtimeVersion: Infinity, baseRevision: 0, command: commands[0]![1] }, { projectId: id, sessionId: id2, commandId: id, baseRealtimeVersion: -1, baseRevision: 0, command: commands[0]![1] }, { projectId: id, sessionId: id2, commandId: id, baseRealtimeVersion: 0.5, baseRevision: 0, command: commands[0]![1] }, { projectId: id, sessionId: id2, commandId: id, baseRealtimeVersion: Number.MAX_SAFE_INTEGER + 1, baseRevision: 0, command: commands[0]![1] }, { ...envelope(commands[0]![1]), document: {} }])('rejects malformed envelope %#', (input) => expect(decodeRealtimeCommandEnvelope(input).ok).toBe(false));
  it('rejects unknown discriminators, authority, React Flow fields, and non-finite layout numbers', () => {
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'createclass', name: 'Class' })).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'MoveNode', elementId: id, position: { x: Number.NaN, y: 2 }, selected: true })).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'ApplyLayout', updates: [{ elementId: id, position: { x: Infinity, y: 2 }, measured: { width: 1 } }] })).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'AddAttribute', classId: id, name: 'field', attributeType: { kind: 'primitive', name: 'String' }, storageVersion: 1 })).ok).toBe(false);
  });
  it('bounds strings and collections and rejects every nested non-finite numeric path', () => {
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'CreateClass', name: 'x'.repeat(MAX_REALTIME_COMMAND_STRING_LENGTH + 1) })).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'ApplyLayout', updates: Array.from({ length: MAX_REALTIME_LAYOUT_UPDATES + 1 }, () => ({ elementId: id, position: { x: 0, y: 0 } })) })).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'CreateAssociation', sourceClassId: id, targetClassId: id2, sourceMultiplicity: { lower: Number.NaN, upper: 1 } })).ok).toBe(false);
    expect(decodeRealtimeCommandEnvelope(envelope({ type: 'MoveNode', elementId: id, position: { x: 0, y: 0 }, size: { width: Infinity, height: 1 } })).ok).toBe(false);
  });
});
