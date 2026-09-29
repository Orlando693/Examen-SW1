import { executeCommand } from '../commands/executors.js';
import type { ProjectResource } from './project-resource.js';
import { CURRENT_DOCUMENT_SCHEMA_VERSION, INITIAL_DOCUMENT_SCHEMA_VERSION } from './project-resource.js';

export type ProjectResourceMigrationResult =
  | { ok: true; value: ProjectResource; migrated: boolean }
  | { ok: false; code: 'LEGACY_MANY_TO_MANY_MIGRATION_FAILED' };

export function migrateProjectResource(resource: ProjectResource): ProjectResourceMigrationResult {
  if (resource.documentSchemaVersion === CURRENT_DOCUMENT_SCHEMA_VERSION) return { ok: true, value: resource, migrated: false };
  if (resource.documentSchemaVersion === 2) return { ok: true, migrated: true, value: { ...resource, project: repairMalformedMaterializedAssociations(resource.project), documentSchemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION } };
  if (resource.documentSchemaVersion !== INITIAL_DOCUMENT_SCHEMA_VERSION) return { ok: false, code: 'LEGACY_MANY_TO_MANY_MIGRATION_FAILED' };
  let project = structuredClone(resource.project);
  for (const relationship of [...project.model.relationships]) {
    if (relationship.kind !== 'association' || relationship.source.multiplicity?.upper !== '*' || relationship.target.multiplicity?.upper !== '*') continue;
    const source = project.model.classes.find((item) => item.id === relationship.source.classId);
    const target = project.model.classes.find((item) => item.id === relationship.target.classId);
    const self = relationship.source.classId === relationship.target.classId;
    const sourceRole = relationship.source.roleName?.trim();
    const targetRole = relationship.target.roleName?.trim();
    if (!source || !target || (self && (!relationship.name?.trim() || !sourceRole || !targetRole || sourceRole === targetRole))) {
      return { ok: false, code: 'LEGACY_MANY_TO_MANY_MIGRATION_FAILED' };
    }
    const baseName = self ? `${source.name}${pascal(relationship.name!)}` : `${source.name}${target.name}${relationship.name?.trim() ? pascal(relationship.name) : ''}`;
    const className = availableName(project.model.classes.map((item) => item.name), baseName);
    const result = executeCommand(project, {
      type: 'MaterializeManyToManyAssociation',
      sourceClassId: relationship.source.classId, targetClassId: relationship.target.classId,
      name: relationship.name, sourceMultiplicity: relationship.source.multiplicity, targetMultiplicity: relationship.target.multiplicity,
      ...(relationship.source.roleName === undefined ? {} : { sourceRoleName: relationship.source.roleName }),
      ...(relationship.target.roleName === undefined ? {} : { targetRoleName: relationship.target.roleName }),
      replaceRelationshipId: relationship.id,
      associationClassId: `${relationship.id}:association-class`, identifierAttributeId: `${relationship.id}:association-id`,
      sourceRelationshipId: `${relationship.id}:association-source`, targetRelationshipId: `${relationship.id}:association-target`,
      layoutNodeId: `${relationship.id}:association-layout`, associationClassName: className,
    }, { now: project.timestamps.updatedAt });
    if (!result.ok) return { ok: false, code: 'LEGACY_MANY_TO_MANY_MIGRATION_FAILED' };
    project = result.document;
  }
  return { ok: true, migrated: true, value: { ...resource, project, documentSchemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION } };
}

function repairMalformedMaterializedAssociations(project: ProjectResource['project']): ProjectResource['project'] {
  const next = structuredClone(project);
  for (const associationClass of next.model.classes) {
    if (!associationClass.attributes.some((attribute) => attribute.name === 'id' && attribute.generation?.identifier === true)) continue;
    const related = next.model.relationships.filter((relationship) => relationship.kind === 'association' && (relationship.source.classId === associationClass.id || relationship.target.classId === associationClass.id));
    if (related.length !== 2 || !related.every(isMalformedMaterializationEdge)) continue;
    next.model.relationships = next.model.relationships.map((relationship) => {
      if (!related.some((candidate) => candidate.id === relationship.id)) return relationship;
      const endpoint = relationship.source.classId === associationClass.id ? relationship.target : relationship.source;
      return {
        id: relationship.id,
        kind: 'association' as const,
        ...(relationship.name === undefined ? {} : { name: relationship.name }),
        source: { classId: endpoint.classId, ...(endpoint.roleName === undefined ? {} : { roleName: endpoint.roleName }), multiplicity: { lower: 1, upper: 1 } },
        target: { classId: associationClass.id, multiplicity: { lower: 0, upper: '*' as const } },
      };
    });
  }
  return next;
}

function isMalformedMaterializationEdge(relationship: ProjectResource['project']['model']['relationships'][number]): boolean {
  const source = relationship.source.multiplicity;
  const target = relationship.target.multiplicity;
  return (source === undefined && target?.lower === 1 && target.upper === 1) || (target === undefined && source?.lower === 1 && source.upper === 1);
}

function pascal(value: string): string { return value.trim().split(/[^A-Za-z0-9]+/).filter(Boolean).map((part) => part[0]!.toUpperCase() + part.slice(1)).join(''); }
function availableName(names: string[], base: string): string { let name = base; let suffix = 2; while (names.includes(name)) name = `${base}${suffix++}`; return name; }
