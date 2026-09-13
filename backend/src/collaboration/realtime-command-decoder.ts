import type { UmlCommand } from '@examen-sw1/uml-core';

type RecordValue = Record<string, unknown>;
export type RealtimeCommandEnvelope = { projectId: string; sessionId: string; commandId: string; baseRealtimeVersion: number; baseRevision: number; command: UmlCommand };
export type RealtimeCommandDecodeResult = { ok: true; data: RealtimeCommandEnvelope } | { ok: false; code: 'INVALID_COMMAND' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_REALTIME_COMMAND_STRING_LENGTH = 256;
export const MAX_REALTIME_LAYOUT_UPDATES = 1_000;
const VISIBILITIES = new Set(['public', 'private', 'protected', 'package']);
const PRIMITIVES = new Set(['string', 'number', 'boolean', 'date', 'datetime', 'void']);
const ASSOCIATIONS = new Set(['association', 'aggregation', 'composition']);
const TYPES = new Set(['CreateClass', 'DeleteClass', 'RenameClass', 'CreateEnumeration', 'RenameEnumeration', 'DeleteEnumeration', 'AddEnumerationLiteral', 'UpdateEnumerationLiteral', 'RemoveEnumerationLiteral', 'AddAttribute', 'RemoveAttribute', 'UpdateAttribute', 'CreateAssociation', 'CreateGeneralization', 'DeleteRelationship', 'UpdateMultiplicity', 'UpdateRelationship', 'MoveNode', 'ApplyLayout']);
const COMMAND_KEYS: Record<string, string[]> = {
  CreateClass: ['type', 'classId', 'name', 'packageId', 'generation'], DeleteClass: ['type', 'classId'], RenameClass: ['type', 'classId', 'name'], CreateEnumeration: ['type', 'enumerationId', 'name', 'packageId', 'generation'], RenameEnumeration: ['type', 'enumerationId', 'name'], DeleteEnumeration: ['type', 'enumerationId'], AddEnumerationLiteral: ['type', 'enumerationId', 'literalId', 'name', 'generation'], UpdateEnumerationLiteral: ['type', 'enumerationId', 'literalId', 'name', 'generation'], RemoveEnumerationLiteral: ['type', 'enumerationId', 'literalId'], AddAttribute: ['type', 'classId', 'attributeId', 'name', 'attributeType', 'visibility', 'generation'], RemoveAttribute: ['type', 'classId', 'attributeId'], UpdateAttribute: ['type', 'classId', 'attributeId', 'name', 'attributeType', 'visibility', 'generation'], CreateAssociation: ['type', 'relationshipId', 'kind', 'name', 'sourceClassId', 'targetClassId', 'sourceMultiplicity', 'targetMultiplicity'], CreateGeneralization: ['type', 'relationshipId', 'sourceClassId', 'targetClassId', 'name'], DeleteRelationship: ['type', 'relationshipId'], UpdateMultiplicity: ['type', 'relationshipId', 'endpoint', 'multiplicity'], UpdateRelationship: ['type', 'relationshipId', 'name', 'sourceMultiplicity', 'targetMultiplicity'], MoveNode: ['type', 'elementId', 'position', 'size', 'nodeId'], ApplyLayout: ['type', 'updates'],
};

function object(value: unknown, keys: string[]): RecordValue | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const result = value as RecordValue;
  return Object.keys(result).every((key) => keys.includes(key)) ? result : undefined;
}
function string(value: unknown): value is string { return typeof value === 'string' && value.length <= MAX_REALTIME_COMMAND_STRING_LENGTH; }
function uuid(value: unknown): value is string { return string(value) && UUID.test(value); }
function version(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function optional(record: RecordValue, key: string, decoder: (value: unknown) => boolean): boolean { return !(key in record) || decoder(record[key]); }
function required(record: RecordValue, key: string, decoder: (value: unknown) => boolean): boolean { return key in record && decoder(record[key]); }
function generation(value: unknown): boolean {
  const record = object(value, ['entity', 'auditable', 'readOnly', 'searchable', 'crud', 'required', 'unique', 'sortable', 'defaultSort']);
  return record !== undefined && Object.entries(record).every(([key, item]) => key === 'defaultSort' ? item === 'asc' || item === 'desc' : typeof item === 'boolean');
}
function typeRef(value: unknown): boolean {
  const record = object(value, ['kind', 'name', 'classId', 'enumerationId']);
  if (!record || !string(record.kind)) return false;
  if (record.kind === 'primitive') return Object.keys(record).length === 2 && PRIMITIVES.has(record.name as string);
  if (record.kind === 'class') return Object.keys(record).length === 2 && uuid(record.classId);
  if (record.kind === 'enumeration') return Object.keys(record).length === 2 && uuid(record.enumerationId);
  return record.kind === 'custom' && Object.keys(record).length === 2 && string(record.name);
}
function multiplicity(value: unknown): boolean {
  const record = object(value, ['lower', 'upper']);
  return record !== undefined && version(record.lower) && (record.upper === '*' || version(record.upper));
}
function position(value: unknown): boolean { const record = object(value, ['x', 'y']); return record !== undefined && finite(record.x) && finite(record.y); }
function size(value: unknown): boolean { const record = object(value, ['width', 'height']); return record !== undefined && finite(record.width) && finite(record.height) && record.width >= 0 && record.height >= 0; }
function layoutUpdate(value: unknown): boolean {
  const record = object(value, ['elementId', 'position', 'size', 'nodeId']);
  return record !== undefined && required(record, 'elementId', uuid) && required(record, 'position', position) && optional(record, 'size', size) && optional(record, 'nodeId', uuid);
}

function command(value: unknown): UmlCommand | undefined {
  const base = object(value, ['type', 'classId', 'name', 'packageId', 'generation', 'enumerationId', 'literalId', 'attributeId', 'attributeType', 'visibility', 'relationshipId', 'kind', 'sourceClassId', 'targetClassId', 'sourceMultiplicity', 'targetMultiplicity', 'endpoint', 'multiplicity', 'elementId', 'position', 'size', 'nodeId', 'updates']);
  if (!base || !string(base.type) || !TYPES.has(base.type)) return undefined;
  const type = base.type;
  if (!Object.keys(base).every((key) => COMMAND_KEYS[type]!.includes(key))) return undefined;
  const gen = () => optional(base, 'generation', generation);
  const name = (key = 'name') => required(base, key, string);
  const id = (key: string) => required(base, key, uuid);
  const optionalId = (key: string) => optional(base, key, uuid);
  let valid = false;
  switch (base.type) {
    case 'CreateClass': valid = name() && optionalId('classId') && optionalId('packageId') && gen(); break;
    case 'DeleteClass': valid = id('classId'); break;
    case 'RenameClass': valid = id('classId') && name(); break;
    case 'CreateEnumeration': valid = name() && optionalId('enumerationId') && optionalId('packageId') && gen(); break;
    case 'RenameEnumeration': valid = id('enumerationId') && name(); break;
    case 'DeleteEnumeration': valid = id('enumerationId'); break;
    case 'AddEnumerationLiteral': valid = id('enumerationId') && name() && optionalId('literalId') && gen(); break;
    case 'UpdateEnumerationLiteral': valid = id('enumerationId') && id('literalId') && optional(base, 'name', string) && gen() && ('name' in base || 'generation' in base); break;
    case 'RemoveEnumerationLiteral': valid = id('enumerationId') && id('literalId'); break;
    case 'AddAttribute': valid = id('classId') && name() && required(base, 'attributeType', typeRef) && optional(base, 'visibility', (item) => string(item) && VISIBILITIES.has(item)) && optionalId('attributeId') && gen(); break;
    case 'RemoveAttribute': valid = id('classId') && id('attributeId'); break;
    case 'UpdateAttribute': valid = id('classId') && id('attributeId') && optional(base, 'name', string) && optional(base, 'attributeType', typeRef) && optional(base, 'visibility', (item) => string(item) && VISIBILITIES.has(item)) && gen() && ('name' in base || 'attributeType' in base || 'visibility' in base || 'generation' in base); break;
    case 'CreateAssociation': valid = id('sourceClassId') && id('targetClassId') && optionalId('relationshipId') && optional(base, 'kind', (item) => string(item) && ASSOCIATIONS.has(item)) && optional(base, 'name', string) && optional(base, 'sourceMultiplicity', multiplicity) && optional(base, 'targetMultiplicity', multiplicity); break;
    case 'CreateGeneralization': valid = id('sourceClassId') && id('targetClassId') && optionalId('relationshipId') && optional(base, 'name', string); break;
    case 'DeleteRelationship': valid = id('relationshipId'); break;
    case 'UpdateMultiplicity': valid = id('relationshipId') && (base.endpoint === 'source' || base.endpoint === 'target') && required(base, 'multiplicity', multiplicity); break;
    case 'UpdateRelationship': valid = id('relationshipId') && optional(base, 'name', (item) => item === null || string(item)) && optional(base, 'sourceMultiplicity', (item) => item === null || multiplicity(item)) && optional(base, 'targetMultiplicity', (item) => item === null || multiplicity(item)) && ('name' in base || 'sourceMultiplicity' in base || 'targetMultiplicity' in base); break;
    case 'MoveNode': valid = id('elementId') && required(base, 'position', position) && optional(base, 'size', size) && optionalId('nodeId'); break;
    case 'ApplyLayout': valid = Array.isArray(base.updates) && base.updates.length <= MAX_REALTIME_LAYOUT_UPDATES && base.updates.every(layoutUpdate); break;
  }
  return valid ? base as unknown as UmlCommand : undefined;
}

export function decodeRealtimeCommandEnvelope(input: unknown): RealtimeCommandDecodeResult {
  const envelope = object(input, ['projectId', 'sessionId', 'commandId', 'baseRealtimeVersion', 'baseRevision', 'command']);
  if (!envelope || !required(envelope, 'projectId', uuid) || !required(envelope, 'sessionId', uuid) || !required(envelope, 'commandId', uuid) || !required(envelope, 'baseRealtimeVersion', version) || !required(envelope, 'baseRevision', version)) return { ok: false, code: 'INVALID_COMMAND' };
  const decodedCommand = command(envelope.command);
  return decodedCommand ? { ok: true, data: { projectId: envelope.projectId as string, sessionId: envelope.sessionId as string, commandId: envelope.commandId as string, baseRealtimeVersion: envelope.baseRealtimeVersion as number, baseRevision: envelope.baseRevision as number, command: decodedCommand } } : { ok: false, code: 'INVALID_COMMAND' };
}
