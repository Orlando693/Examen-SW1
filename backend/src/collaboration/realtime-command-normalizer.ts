import type { ProjectResource, UmlCommand } from '@examen-sw1/uml-core';
import { MAX_REALTIME_LAYOUT_UPDATES } from './realtime-command-decoder.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface RealtimeNormalizationContext { appliedAt: string; generatedIds: readonly string[]; }
export type NormalizedRealtimeCommand = { command: UmlCommand; appliedAt: string };
export type NormalizeRealtimeCommandResult = { ok: true; data: NormalizedRealtimeCommand } | { ok: false; code: 'INVALID_NORMALIZATION' };

function ids(resource: ProjectResource): Set<string> {
  return new Set([resource.project.id, ...resource.project.model.classes.flatMap((item) => [item.id, ...item.attributes.map((attribute) => attribute.id)]), ...resource.project.model.enumerations.flatMap((item) => [item.id, ...item.literals.map((literal) => literal.id)]), ...resource.project.model.relationships.map((item) => item.id), ...resource.project.layout.nodes.map((item) => item.id)]);
}
function elements(resource: ProjectResource): Set<string> { return new Set([...resource.project.model.classes.map((item) => item.id), ...resource.project.model.enumerations.map((item) => item.id)]); }
function validTimestamp(value: string): boolean { return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }

export function normalizeRealtimeCommand(command: UmlCommand, resource: ProjectResource, context: RealtimeNormalizationContext): NormalizeRealtimeCommandResult {
  if (!validTimestamp(context.appliedAt)) return { ok: false, code: 'INVALID_NORMALIZATION' };
  const used = ids(resource); let nextId = 0;
  const materialize = (provided: string | undefined): string | undefined => {
    if (provided !== undefined) return used.has(provided) ? undefined : (used.add(provided), provided);
    const generated = context.generatedIds[nextId++];
    if (!generated || !UUID.test(generated) || used.has(generated)) return undefined;
    used.add(generated); return generated;
  };
  const finish = (normalized: UmlCommand): NormalizeRealtimeCommandResult => ({ ok: true, data: { command: normalized, appliedAt: context.appliedAt } });
  switch (command.type) {
    case 'CreateClass': { const classId = materialize(command.classId); return classId ? finish({ ...command, classId }) : { ok: false, code: 'INVALID_NORMALIZATION' }; }
    case 'CreateEnumeration': { const enumerationId = materialize(command.enumerationId); return enumerationId ? finish({ ...command, enumerationId }) : { ok: false, code: 'INVALID_NORMALIZATION' }; }
    case 'AddEnumerationLiteral': { const literalId = materialize(command.literalId); return literalId ? finish({ ...command, literalId }) : { ok: false, code: 'INVALID_NORMALIZATION' }; }
    case 'AddAttribute': { const attributeId = materialize(command.attributeId); return attributeId ? finish({ ...command, attributeId, visibility: command.visibility ?? 'private' }) : { ok: false, code: 'INVALID_NORMALIZATION' }; }
    case 'CreateAssociation': { const relationshipId = materialize(command.relationshipId); return relationshipId ? finish({ ...command, relationshipId, kind: command.kind ?? 'association' }) : { ok: false, code: 'INVALID_NORMALIZATION' }; }
    case 'CreateGeneralization': { const relationshipId = materialize(command.relationshipId); return relationshipId ? finish({ ...command, relationshipId }) : { ok: false, code: 'INVALID_NORMALIZATION' }; }
    case 'MoveNode': {
      if (!elements(resource).has(command.elementId)) return { ok: false, code: 'INVALID_NORMALIZATION' };
      const existing = resource.project.layout.nodes.find((node) => node.elementId === command.elementId);
      if (existing) return finish({ type: 'MoveNode', elementId: command.elementId, position: command.position, ...(command.size === undefined ? {} : { size: command.size }) });
      const nodeId = materialize(command.nodeId); return nodeId ? finish({ ...command, nodeId }) : { ok: false, code: 'INVALID_NORMALIZATION' };
    }
    case 'ApplyLayout': {
      if (command.updates.length > MAX_REALTIME_LAYOUT_UPDATES) return { ok: false, code: 'INVALID_NORMALIZATION' };
      const seen = new Set<string>(); const updates: typeof command.updates = [];
      for (const update of command.updates) {
        if (!elements(resource).has(update.elementId) || seen.has(update.elementId)) return { ok: false, code: 'INVALID_NORMALIZATION' };
        seen.add(update.elementId);
        const existing = resource.project.layout.nodes.find((node) => node.elementId === update.elementId);
        if (existing) { updates.push({ elementId: update.elementId, position: update.position, ...(update.size === undefined ? {} : { size: update.size }) }); continue; }
        const nodeId = materialize(update.nodeId); if (!nodeId) return { ok: false, code: 'INVALID_NORMALIZATION' }; updates.push({ ...update, nodeId });
      }
      return finish({ ...command, updates });
    }
    default: return finish(structuredClone(command));
  }
}
