import { createUuid } from '../ids.js';
import { cloneProjectDocument, type ProjectDocument, touchProjectDocument } from '../model/document.js';
import type { DiagramNodeLayout } from '../model/layout.js';
import type { UmlAssociationRelationship, UmlGeneralizationRelationship } from '../model/relationships.js';
import type { UmlAttribute, UmlClass, UmlEnumeration, UmlEnumerationLiteral } from '../model/types.js';
import { validateProjectDocument } from '../validation/validate.js';
import type { UmlCommand } from './commands.js';
import type { CommandResult } from './results.js';

export interface ExecuteCommandOptions {
  validate?: boolean;
  now?: string;
}

export function executeCommand(document: ProjectDocument, command: UmlCommand, options: ExecuteCommandOptions = {}): CommandResult {
  switch (command.type) {
    case 'CreateClass':
      return withValidation(document, command, createClass(document, command, options), options);
    case 'DeleteClass':
      return deleteClass(document, command, options);
    case 'RenameClass':
      return renameClass(document, command, options);
    case 'CreateEnumeration':
      return withValidation(document, command, createEnumeration(document, command, options), options);
    case 'RenameEnumeration':
      return renameEnumeration(document, command, options);
    case 'DeleteEnumeration':
      return deleteEnumeration(document, command, options);
    case 'AddEnumerationLiteral':
      return addEnumerationLiteral(document, command, options);
    case 'UpdateEnumerationLiteral':
      return updateEnumerationLiteral(document, command, options);
    case 'RemoveEnumerationLiteral':
      return removeEnumerationLiteral(document, command, options);
    case 'AddAttribute':
      return addAttribute(document, command, options);
    case 'RemoveAttribute':
      return removeAttribute(document, command, options);
    case 'UpdateAttribute':
      return updateAttribute(document, command, options);
    case 'CreateAssociation':
      return withValidation(document, command, createAssociation(document, command, options), options);
    case 'CreateGeneralization':
      return withValidation(document, command, createGeneralization(document, command, options), options);
    case 'DeleteRelationship':
      return deleteRelationship(document, command, options);
    case 'UpdateMultiplicity':
      return updateMultiplicity(document, command, options);
    case 'UpdateRelationship':
      return updateRelationship(document, command, options);
    case 'MaterializeManyToManyAssociation':
      return materializeManyToManyAssociation(document, command, options);
    case 'MoveNode':
      return withValidation(document, command, moveNode(document, command, options), options);
    case 'ApplyLayout':
      return withValidation(document, command, applyLayout(document, command, options), options);
    default:
      return reject(document, command, 'UNSUPPORTED_COMMAND', 'Unsupported command.');
  }
}

function reject(document: ProjectDocument, command: UmlCommand, reason: 'UNSUPPORTED_COMMAND' | 'NOT_FOUND' | 'VALIDATION_FAILED' | 'INVALID_COMMAND', message: string): CommandResult {
  return { ok: false, command, document, reason, message, diagnostics: [] };
}

function accept(command: UmlCommand, document: ProjectDocument): CommandResult {
  return { ok: true, command, document, diagnostics: [] };
}

function withValidation(original: ProjectDocument, command: UmlCommand, result: CommandResult, options: ExecuteCommandOptions): CommandResult {
  if (!result.ok || options.validate === false) {
    return result;
  }

  const validation = validateProjectDocument(result.document);
  if (validation.hasErrors) {
    return {
      ok: false,
      command,
      document: original,
      reason: 'VALIDATION_FAILED',
      message: 'Command produced validation errors.',
      diagnostics: validation.diagnostics,
    };
  }

  return { ...result, diagnostics: validation.diagnostics };
}

function nextDocument(document: ProjectDocument, options: ExecuteCommandOptions): ProjectDocument {
  return touchProjectDocument(cloneProjectDocument(document), options.now);
}

function createClass(document: ProjectDocument, command: Extract<UmlCommand, { type: 'CreateClass' }>, options: ExecuteCommandOptions): CommandResult {
  const next = nextDocument(document, options);
  const umlClass: UmlClass = {
    id: createUuid(command.classId),
    name: command.name,
    ...(command.packageId === undefined ? {} : { packageId: command.packageId }),
    attributes: [],
    operations: [],
    ...(command.generation === undefined ? {} : { generation: command.generation }),
  };
  next.model.classes.push(umlClass);
  return accept(command, next);
}

function deleteClass(document: ProjectDocument, command: Extract<UmlCommand, { type: 'DeleteClass' }>, options: ExecuteCommandOptions): CommandResult {
  if (!document.model.classes.some((umlClass) => umlClass.id === command.classId)) {
    return reject(document, command, 'NOT_FOUND', `Class '${command.classId}' was not found.`);
  }
  const next = nextDocument(document, options);
  next.model.classes = next.model.classes.filter((umlClass) => umlClass.id !== command.classId);
  next.model.relationships = next.model.relationships.filter((relationship) => relationship.source.classId !== command.classId && relationship.target.classId !== command.classId);
  next.layout.nodes = next.layout.nodes.filter((node) => node.elementId !== command.classId);
  return withValidation(document, command, accept(command, next), options);
}

function renameClass(document: ProjectDocument, command: Extract<UmlCommand, { type: 'RenameClass' }>, options: ExecuteCommandOptions): CommandResult {
  const classIndex = document.model.classes.findIndex((umlClass) => umlClass.id === command.classId);
  if (classIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Class '${command.classId}' was not found.`);
  }
  const next = nextDocument(document, options);
  next.model.classes[classIndex] = { ...next.model.classes[classIndex], name: command.name };
  return withValidation(document, command, accept(command, next), options);
}

function createEnumeration(document: ProjectDocument, command: Extract<UmlCommand, { type: 'CreateEnumeration' }>, options: ExecuteCommandOptions): CommandResult {
  const next = nextDocument(document, options);
  const enumeration: UmlEnumeration = {
    id: createUuid(command.enumerationId),
    name: command.name,
    ...(command.packageId === undefined ? {} : { packageId: command.packageId }),
    literals: [],
    ...(command.generation === undefined ? {} : { generation: command.generation }),
  };
  next.model.enumerations.push(enumeration);
  return accept(command, next);
}

function renameEnumeration(document: ProjectDocument, command: Extract<UmlCommand, { type: 'RenameEnumeration' }>, options: ExecuteCommandOptions): CommandResult {
  const enumerationIndex = document.model.enumerations.findIndex((enumeration) => enumeration.id === command.enumerationId);
  if (enumerationIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Enumeration '${command.enumerationId}' was not found.`);
  }
  const next = nextDocument(document, options);
  next.model.enumerations[enumerationIndex] = { ...next.model.enumerations[enumerationIndex], name: command.name };
  return withValidation(document, command, accept(command, next), options);
}

function deleteEnumeration(document: ProjectDocument, command: Extract<UmlCommand, { type: 'DeleteEnumeration' }>, options: ExecuteCommandOptions): CommandResult {
  if (!document.model.enumerations.some((enumeration) => enumeration.id === command.enumerationId)) {
    return reject(document, command, 'NOT_FOUND', `Enumeration '${command.enumerationId}' was not found.`);
  }
  const next = nextDocument(document, options);
  next.model.enumerations = next.model.enumerations.filter((enumeration) => enumeration.id !== command.enumerationId);
  next.layout.nodes = next.layout.nodes.filter((node) => node.elementId !== command.enumerationId);
  return withValidation(document, command, accept(command, next), options);
}

function addEnumerationLiteral(document: ProjectDocument, command: Extract<UmlCommand, { type: 'AddEnumerationLiteral' }>, options: ExecuteCommandOptions): CommandResult {
  const enumerationIndex = document.model.enumerations.findIndex((enumeration) => enumeration.id === command.enumerationId);
  if (enumerationIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Enumeration '${command.enumerationId}' was not found.`);
  }
  const next = nextDocument(document, options);
  const literal: UmlEnumerationLiteral = {
    id: createUuid(command.literalId),
    name: command.name,
    ...(command.generation === undefined ? {} : { generation: command.generation }),
  };
  next.model.enumerations[enumerationIndex].literals.push(literal);
  return withValidation(document, command, accept(command, next), options);
}

function updateEnumerationLiteral(document: ProjectDocument, command: Extract<UmlCommand, { type: 'UpdateEnumerationLiteral' }>, options: ExecuteCommandOptions): CommandResult {
  const enumerationIndex = document.model.enumerations.findIndex((enumeration) => enumeration.id === command.enumerationId);
  const literalIndex = enumerationIndex < 0 ? -1 : document.model.enumerations[enumerationIndex].literals.findIndex((literal) => literal.id === command.literalId);
  if (enumerationIndex < 0 || literalIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Enumeration literal '${command.literalId}' was not found.`);
  }
  const next = nextDocument(document, options);
  const current = next.model.enumerations[enumerationIndex].literals[literalIndex];
  next.model.enumerations[enumerationIndex].literals[literalIndex] = {
    ...current,
    ...(command.name === undefined ? {} : { name: command.name }),
    ...(command.generation === undefined ? {} : { generation: command.generation }),
  };
  return withValidation(document, command, accept(command, next), options);
}

function removeEnumerationLiteral(document: ProjectDocument, command: Extract<UmlCommand, { type: 'RemoveEnumerationLiteral' }>, options: ExecuteCommandOptions): CommandResult {
  const enumerationIndex = document.model.enumerations.findIndex((enumeration) => enumeration.id === command.enumerationId);
  if (enumerationIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Enumeration '${command.enumerationId}' was not found.`);
  }
  if (!document.model.enumerations[enumerationIndex].literals.some((literal) => literal.id === command.literalId)) {
    return reject(document, command, 'NOT_FOUND', `Enumeration literal '${command.literalId}' was not found.`);
  }
  const next = nextDocument(document, options);
  next.model.enumerations[enumerationIndex].literals = next.model.enumerations[enumerationIndex].literals.filter((literal) => literal.id !== command.literalId);
  return withValidation(document, command, accept(command, next), options);
}

function addAttribute(document: ProjectDocument, command: Extract<UmlCommand, { type: 'AddAttribute' }>, options: ExecuteCommandOptions): CommandResult {
  const classIndex = document.model.classes.findIndex((umlClass) => umlClass.id === command.classId);
  if (classIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Class '${command.classId}' was not found.`);
  }
  const next = nextDocument(document, options);
  const attribute: UmlAttribute = {
    id: createUuid(command.attributeId),
    name: command.name,
    type: command.attributeType,
    visibility: command.visibility ?? 'private',
    ...(command.generation === undefined ? {} : { generation: command.generation }),
  };
  next.model.classes[classIndex].attributes.push(attribute);
  return withValidation(document, command, accept(command, next), options);
}

function removeAttribute(document: ProjectDocument, command: Extract<UmlCommand, { type: 'RemoveAttribute' }>, options: ExecuteCommandOptions): CommandResult {
  const classIndex = document.model.classes.findIndex((umlClass) => umlClass.id === command.classId);
  if (classIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Class '${command.classId}' was not found.`);
  }
  if (!document.model.classes[classIndex].attributes.some((attribute) => attribute.id === command.attributeId)) {
    return reject(document, command, 'NOT_FOUND', `Attribute '${command.attributeId}' was not found.`);
  }
  const next = nextDocument(document, options);
  next.model.classes[classIndex].attributes = next.model.classes[classIndex].attributes.filter((attribute) => attribute.id !== command.attributeId);
  return withValidation(document, command, accept(command, next), options);
}

function updateAttribute(document: ProjectDocument, command: Extract<UmlCommand, { type: 'UpdateAttribute' }>, options: ExecuteCommandOptions): CommandResult {
  const classIndex = document.model.classes.findIndex((umlClass) => umlClass.id === command.classId);
  const attributeIndex = classIndex < 0 ? -1 : document.model.classes[classIndex].attributes.findIndex((attribute) => attribute.id === command.attributeId);
  if (classIndex < 0 || attributeIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Attribute '${command.attributeId}' was not found.`);
  }
  const next = nextDocument(document, options);
  const current = next.model.classes[classIndex].attributes[attributeIndex];
  next.model.classes[classIndex].attributes[attributeIndex] = {
    ...current,
    ...(command.name === undefined ? {} : { name: command.name }),
    ...(command.attributeType === undefined ? {} : { type: command.attributeType }),
    ...(command.visibility === undefined ? {} : { visibility: command.visibility }),
    ...(command.generation === undefined ? {} : { generation: command.generation }),
  };
  return withValidation(document, command, accept(command, next), options);
}

function createAssociation(document: ProjectDocument, command: Extract<UmlCommand, { type: 'CreateAssociation' }>, options: ExecuteCommandOptions): CommandResult {
  const next = nextDocument(document, options);
  const relationship: UmlAssociationRelationship = {
    id: createUuid(command.relationshipId),
    kind: command.kind ?? 'association',
    ...(command.name === undefined ? {} : { name: command.name }),
    source: {
      classId: command.sourceClassId,
      ...(command.sourceMultiplicity === undefined ? {} : { multiplicity: command.sourceMultiplicity }),
      ...(command.sourceRoleName === undefined ? {} : { roleName: command.sourceRoleName.trim() }),
    },
    target: {
      classId: command.targetClassId,
      ...(command.targetMultiplicity === undefined ? {} : { multiplicity: command.targetMultiplicity }),
      ...(command.targetRoleName === undefined ? {} : { roleName: command.targetRoleName.trim() }),
    },
  };
  next.model.relationships.push(relationship);
  return accept(command, next);
}

function createGeneralization(document: ProjectDocument, command: Extract<UmlCommand, { type: 'CreateGeneralization' }>, options: ExecuteCommandOptions): CommandResult {
  const next = nextDocument(document, options);
  const relationship: UmlGeneralizationRelationship = {
    id: createUuid(command.relationshipId),
    kind: 'generalization',
    ...(command.name === undefined ? {} : { name: command.name }),
    source: { classId: command.sourceClassId },
    target: { classId: command.targetClassId },
  };
  next.model.relationships.push(relationship);
  return accept(command, next);
}

function deleteRelationship(document: ProjectDocument, command: Extract<UmlCommand, { type: 'DeleteRelationship' }>, options: ExecuteCommandOptions): CommandResult {
  if (!document.model.relationships.some((relationship) => relationship.id === command.relationshipId)) {
    return reject(document, command, 'NOT_FOUND', `Relationship '${command.relationshipId}' was not found.`);
  }
  const next = nextDocument(document, options);
  next.model.relationships = next.model.relationships.filter((relationship) => relationship.id !== command.relationshipId);
  return withValidation(document, command, accept(command, next), options);
}

function updateMultiplicity(document: ProjectDocument, command: Extract<UmlCommand, { type: 'UpdateMultiplicity' }>, options: ExecuteCommandOptions): CommandResult {
  const relationshipIndex = document.model.relationships.findIndex((relationship) => relationship.id === command.relationshipId);
  if (relationshipIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Relationship '${command.relationshipId}' was not found.`);
  }
  const relationship = document.model.relationships[relationshipIndex];
  if (relationship.kind === 'generalization') {
    return reject(document, command, 'INVALID_COMMAND', 'Generalization relationships do not have multiplicity.');
  }
  const next = nextDocument(document, options);
  const nextRelationship = next.model.relationships[relationshipIndex];
  nextRelationship[command.endpoint] = {
    ...nextRelationship[command.endpoint],
    multiplicity: command.multiplicity,
  };
  return withValidation(document, command, accept(command, next), options);
}

function updateRelationship(document: ProjectDocument, command: Extract<UmlCommand, { type: 'UpdateRelationship' }>, options: ExecuteCommandOptions): CommandResult {
  const relationshipIndex = document.model.relationships.findIndex((relationship) => relationship.id === command.relationshipId);
  if (relationshipIndex < 0) {
    return reject(document, command, 'NOT_FOUND', `Relationship '${command.relationshipId}' was not found.`);
  }
  const relationship = document.model.relationships[relationshipIndex];
  if (relationship.kind === 'generalization' && (command.sourceMultiplicity !== undefined || command.targetMultiplicity !== undefined)) {
    return reject(document, command, 'INVALID_COMMAND', 'Generalization relationships do not have multiplicity.');
  }

  const next = nextDocument(document, options);
  const current = next.model.relationships[relationshipIndex];
  const nextRelationship = {
    ...current,
    ...(command.name === undefined ? {} : command.name === null ? { name: undefined } : { name: command.name }),
  };
  if (nextRelationship.kind !== 'generalization') {
    nextRelationship.source = {
      ...nextRelationship.source,
      ...(command.sourceMultiplicity === undefined ? {} : { multiplicity: command.sourceMultiplicity ?? undefined }),
      ...(command.sourceRoleName === undefined ? {} : { roleName: command.sourceRoleName?.trim() || undefined }),
    };
    nextRelationship.target = {
      ...nextRelationship.target,
      ...(command.targetMultiplicity === undefined ? {} : { multiplicity: command.targetMultiplicity ?? undefined }),
      ...(command.targetRoleName === undefined ? {} : { roleName: command.targetRoleName?.trim() || undefined }),
    };
  }
  next.model.relationships[relationshipIndex] = nextRelationship;
  return withValidation(document, command, accept(command, next), options);
}

function materializeManyToManyAssociation(document: ProjectDocument, command: Extract<UmlCommand, { type: 'MaterializeManyToManyAssociation' }>, options: ExecuteCommandOptions): CommandResult {
  const relationship = command.replaceRelationshipId === undefined ? undefined : document.model.relationships.find((item) => item.id === command.replaceRelationshipId);
  if (command.replaceRelationshipId !== undefined && !relationship) return reject(document, command, 'NOT_FOUND', `Relationship '${command.replaceRelationshipId}' was not found.`);
  if (command.kind !== undefined && command.kind !== 'association') {
    return reject(document, command, 'INVALID_COMMAND', 'Only association many-to-many relationships can be materialized.');
  }
  if (command.sourceMultiplicity.upper !== '*' || command.targetMultiplicity.upper !== '*') {
    return reject(document, command, 'INVALID_COMMAND', 'Only association many-to-many relationships can be materialized.');
  }
  if (relationship && (relationship.kind !== 'association' || relationship.source.classId !== command.sourceClassId || relationship.target.classId !== command.targetClassId)) {
    return reject(document, command, 'INVALID_COMMAND', 'Replacement relationship endpoints must match the materialization candidate.');
  }
  const self = command.sourceClassId === command.targetClassId;
  const sourceRole = command.sourceRoleName?.trim();
  const targetRole = command.targetRoleName?.trim();
  if (self && (!command.name?.trim() || !sourceRole || !targetRole || sourceRole === targetRole)) {
    return reject(document, command, 'INVALID_COMMAND', 'Self many-to-many relationships require a name and distinct endpoint roles.');
  }
  const suppliedIds = [command.associationClassId, command.identifierAttributeId, command.sourceRelationshipId, command.targetRelationshipId, command.layoutNodeId].filter((id): id is string => id !== undefined);
  const existingIds = new Set<string>([
    ...document.model.classes.map((item) => item.id),
    ...document.model.classes.flatMap((item) => item.attributes.map((attribute) => attribute.id)),
    ...document.model.relationships.map((item) => item.id),
    ...document.layout.nodes.map((item) => item.id),
  ]);
  if (new Set(suppliedIds).size !== suppliedIds.length || suppliedIds.some((id) => existingIds.has(id))) {
    return reject(document, command, 'INVALID_COMMAND', 'Materialization ids must be unique and unused.');
  }
  if (document.model.classes.some((item) => item.name === command.associationClassName)) {
    return reject(document, command, 'INVALID_COMMAND', `Class '${command.associationClassName}' already exists.`);
  }
  const next = nextDocument(document, options);
  if (relationship) next.model.relationships = next.model.relationships.filter((item) => item.id !== relationship.id);
  const associationClassId = createUuid(command.associationClassId);
  const identifierAttributeId = createUuid(command.identifierAttributeId);
  const sourceRelationshipId = createUuid(command.sourceRelationshipId);
  const targetRelationshipId = createUuid(command.targetRelationshipId);
  next.model.classes.push({ id: associationClassId, name: command.associationClassName, attributes: [{ id: identifierAttributeId, name: 'id', type: { kind: 'primitive', name: 'number' }, visibility: 'private', generation: { identifier: true } }], operations: [] });
  next.model.relationships.push(
    { id: sourceRelationshipId, kind: 'association', source: { classId: command.sourceClassId, ...(sourceRole ? { roleName: sourceRole } : {}), multiplicity: { lower: 1, upper: 1 } }, target: { classId: associationClassId, multiplicity: { lower: 0, upper: '*' } } },
    { id: targetRelationshipId, kind: 'association', source: { classId: command.targetClassId, ...(targetRole ? { roleName: targetRole } : {}), multiplicity: { lower: 1, upper: 1 } }, target: { classId: associationClassId, multiplicity: { lower: 0, upper: '*' } } },
  );
  next.layout.nodes.push({ id: createUuid(command.layoutNodeId), elementId: associationClassId, position: associationEntityPosition(document, command.sourceClassId, command.targetClassId) });
  return withValidation(document, command, accept(command, next), options);
}

function associationEntityPosition(document: ProjectDocument, sourceClassId: string, targetClassId: string): { x: number; y: number } {
  const source = document.layout.nodes.find((node) => node.elementId === sourceClassId)?.position;
  const target = document.layout.nodes.find((node) => node.elementId === targetClassId)?.position;
  if (source && target) return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  if (source) return { x: source.x + 240, y: source.y };
  return { x: 0, y: 0 };
}

function moveNode(document: ProjectDocument, command: Extract<UmlCommand, { type: 'MoveNode' }>, options: ExecuteCommandOptions): CommandResult {
  const next = nextDocument(document, options);
  const nodeIndex = next.layout.nodes.findIndex((node) => node.elementId === command.elementId);
  const node: DiagramNodeLayout = {
    id: createUuid(command.nodeId),
    elementId: command.elementId,
    position: command.position,
    ...(command.size === undefined ? {} : { size: command.size }),
  };

  if (nodeIndex >= 0) {
    next.layout.nodes[nodeIndex] = { ...next.layout.nodes[nodeIndex], position: command.position, ...(command.size === undefined ? {} : { size: command.size }) };
  } else {
    next.layout.nodes.push(node);
  }

  return accept(command, next);
}

function applyLayout(document: ProjectDocument, command: Extract<UmlCommand, { type: 'ApplyLayout' }>, options: ExecuteCommandOptions): CommandResult {
  const next = nextDocument(document, options);

  for (const update of command.updates) {
    const nodeIndex = next.layout.nodes.findIndex((node) => node.elementId === update.elementId);
    if (nodeIndex >= 0) {
      next.layout.nodes[nodeIndex] = {
        ...next.layout.nodes[nodeIndex],
        position: update.position,
        ...(update.size === undefined ? {} : { size: update.size }),
      };
    } else {
      next.layout.nodes.push({
        id: createUuid(update.nodeId),
        elementId: update.elementId,
        position: update.position,
        ...(update.size === undefined ? {} : { size: update.size }),
      });
    }
  }

  return accept(command, next);
}
