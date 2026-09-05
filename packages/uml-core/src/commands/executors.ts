import { createUuid } from '../ids.js';
import { cloneProjectDocument, type ProjectDocument, touchProjectDocument } from '../model/document.js';
import type { DiagramNodeLayout } from '../model/layout.js';
import type { UmlAssociationRelationship } from '../model/relationships.js';
import type { UmlAttribute, UmlClass } from '../model/types.js';
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
    case 'AddAttribute':
      return addAttribute(document, command, options);
    case 'RemoveAttribute':
      return removeAttribute(document, command, options);
    case 'UpdateAttribute':
      return updateAttribute(document, command, options);
    case 'CreateAssociation':
      return withValidation(document, command, createAssociation(document, command, options), options);
    case 'UpdateMultiplicity':
      return updateMultiplicity(document, command, options);
    case 'MoveNode':
      return withValidation(document, command, moveNode(document, command, options), options);
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
    },
    target: {
      classId: command.targetClassId,
      ...(command.targetMultiplicity === undefined ? {} : { multiplicity: command.targetMultiplicity }),
    },
  };
  next.model.relationships.push(relationship);
  return accept(command, next);
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
