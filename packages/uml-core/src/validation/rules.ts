import type { Uuid } from '../ids.js';
import type { ProjectDocument } from '../model/document.js';
import type { Multiplicity, UmlRelationship } from '../model/relationships.js';
import type { UmlAttribute, UmlClass, UmlOperation, UmlPackage } from '../model/types.js';
import type { ValidationDiagnostic } from './diagnostics.js';

type IdRecord = { id: Uuid; path: string; elementType: string };

export type ValidationRule = (document: ProjectDocument) => ValidationDiagnostic[];

export const validationRules: ValidationRule[] = [
  validateDuplicateIds,
  validateRequiredNames,
  validateReferences,
  validateRelationships,
  validateWarnings,
];

function error(code: string, message: string, path: string, elementId?: Uuid, elementType?: string): ValidationDiagnostic {
  return compactDiagnostic({ severity: 'ERROR', code, message, path, elementId, elementType });
}

function warning(code: string, message: string, path: string, elementId?: Uuid, elementType?: string): ValidationDiagnostic {
  return compactDiagnostic({ severity: 'WARNING', code, message, path, elementId, elementType });
}

function compactDiagnostic(diagnostic: ValidationDiagnostic): ValidationDiagnostic {
  return Object.fromEntries(Object.entries(diagnostic).filter(([, value]) => value !== undefined)) as ValidationDiagnostic;
}

function collectIds(document: ProjectDocument): IdRecord[] {
  const ids: IdRecord[] = [
    { id: document.id, path: 'id', elementType: 'ProjectDocument' },
  ];

  document.model.packages.forEach((pkg, packageIndex) => {
    ids.push({ id: pkg.id, path: `model.packages[${packageIndex}].id`, elementType: 'UmlPackage' });
  });

  document.model.classes.forEach((umlClass, classIndex) => {
    ids.push({ id: umlClass.id, path: `model.classes[${classIndex}].id`, elementType: 'UmlClass' });
    umlClass.attributes.forEach((attribute, attributeIndex) => {
      ids.push({ id: attribute.id, path: `model.classes[${classIndex}].attributes[${attributeIndex}].id`, elementType: 'UmlAttribute' });
    });
    umlClass.operations.forEach((operation, operationIndex) => {
      ids.push({ id: operation.id, path: `model.classes[${classIndex}].operations[${operationIndex}].id`, elementType: 'UmlOperation' });
      operation.parameters.forEach((parameter, parameterIndex) => {
        ids.push({ id: parameter.id, path: `model.classes[${classIndex}].operations[${operationIndex}].parameters[${parameterIndex}].id`, elementType: 'UmlOperationParameter' });
      });
    });
  });

  document.model.enumerations.forEach((enumeration, enumerationIndex) => {
    ids.push({ id: enumeration.id, path: `model.enumerations[${enumerationIndex}].id`, elementType: 'UmlEnumeration' });
    enumeration.literals.forEach((literal, literalIndex) => {
      ids.push({ id: literal.id, path: `model.enumerations[${enumerationIndex}].literals[${literalIndex}].id`, elementType: 'UmlEnumerationLiteral' });
    });
  });

  document.model.relationships.forEach((relationship, relationshipIndex) => {
    ids.push({ id: relationship.id, path: `model.relationships[${relationshipIndex}].id`, elementType: 'UmlRelationship' });
  });

  document.layout.nodes.forEach((node, nodeIndex) => {
    ids.push({ id: node.id, path: `layout.nodes[${nodeIndex}].id`, elementType: 'DiagramNodeLayout' });
  });

  return ids;
}

function validateDuplicateIds(document: ProjectDocument): ValidationDiagnostic[] {
  const seen = new Map<Uuid, IdRecord>();
  const diagnostics: ValidationDiagnostic[] = [];

  for (const record of collectIds(document)) {
    const first = seen.get(record.id);
    if (first) {
      diagnostics.push(error('DUPLICATE_ID', `Duplicate id '${record.id}' also appears at ${first.path}.`, record.path, record.id, record.elementType));
      continue;
    }
    seen.set(record.id, record);
  }

  return diagnostics;
}

function validateRequiredNames(document: ProjectDocument): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  if (!document.metadata.name.trim()) {
    diagnostics.push(error('INVALID_NAME', 'Project name is required.', 'metadata.name', document.id, 'ProjectDocument'));
  }

  document.model.packages.forEach((pkg, index) => requireName(pkg, `model.packages[${index}].name`, 'UmlPackage', diagnostics));
  document.model.classes.forEach((umlClass, classIndex) => {
    requireName(umlClass, `model.classes[${classIndex}].name`, 'UmlClass', diagnostics);
    umlClass.attributes.forEach((attribute, attributeIndex) => requireName(attribute, `model.classes[${classIndex}].attributes[${attributeIndex}].name`, 'UmlAttribute', diagnostics));
    umlClass.operations.forEach((operation, operationIndex) => {
      requireName(operation, `model.classes[${classIndex}].operations[${operationIndex}].name`, 'UmlOperation', diagnostics);
      operation.parameters.forEach((parameter, parameterIndex) => requireName(parameter, `model.classes[${classIndex}].operations[${operationIndex}].parameters[${parameterIndex}].name`, 'UmlOperationParameter', diagnostics));
    });
  });
  document.model.enumerations.forEach((enumeration, enumerationIndex) => {
    requireName(enumeration, `model.enumerations[${enumerationIndex}].name`, 'UmlEnumeration', diagnostics);
    enumeration.literals.forEach((literal, literalIndex) => requireName(literal, `model.enumerations[${enumerationIndex}].literals[${literalIndex}].name`, 'UmlEnumerationLiteral', diagnostics));
  });

  return diagnostics;
}

function requireName(element: UmlPackage | UmlClass | UmlAttribute | UmlOperation | { id: Uuid; name: string }, path: string, elementType: string, diagnostics: ValidationDiagnostic[]) {
  if (!element.name.trim()) {
    diagnostics.push(error('INVALID_NAME', `${elementType} name is required.`, path, element.id, elementType));
  }
}

function validateReferences(document: ProjectDocument): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const packageIds = new Set(document.model.packages.map((pkg) => pkg.id));
  const classIds = new Set(document.model.classes.map((umlClass) => umlClass.id));
  const enumerationIds = new Set(document.model.enumerations.map((enumeration) => enumeration.id));
  const semanticIds = new Set<Uuid>([
    ...document.model.packages.map((pkg) => pkg.id),
    ...document.model.classes.map((umlClass) => umlClass.id),
    ...document.model.enumerations.map((enumeration) => enumeration.id),
    ...document.model.relationships.map((relationship) => relationship.id),
  ]);

  document.model.packages.forEach((pkg, index) => {
    if (pkg.parentPackageId && !packageIds.has(pkg.parentPackageId)) {
      diagnostics.push(error('MISSING_REFERENCE', `Package parent '${pkg.parentPackageId}' does not exist.`, `model.packages[${index}].parentPackageId`, pkg.id, 'UmlPackage'));
    }
  });

  document.model.classes.forEach((umlClass, classIndex) => {
    if (umlClass.packageId && !packageIds.has(umlClass.packageId)) {
      diagnostics.push(error('MISSING_REFERENCE', `Class package '${umlClass.packageId}' does not exist.`, `model.classes[${classIndex}].packageId`, umlClass.id, 'UmlClass'));
    }
    validateTypeReferences(umlClass.attributes.map((attribute) => ({ ownerId: attribute.id, ownerType: 'UmlAttribute', type: attribute.type, path: `model.classes[${classIndex}].attributes` })), classIds, enumerationIds, diagnostics);
    validateTypeReferences(umlClass.operations.flatMap((operation, operationIndex) => [
      { ownerId: operation.id, ownerType: 'UmlOperation', type: operation.returnType, path: `model.classes[${classIndex}].operations[${operationIndex}].returnType` },
      ...operation.parameters.map((parameter, parameterIndex) => ({ ownerId: parameter.id, ownerType: 'UmlOperationParameter', type: parameter.type, path: `model.classes[${classIndex}].operations[${operationIndex}].parameters[${parameterIndex}].type` })),
    ]), classIds, enumerationIds, diagnostics);
  });

  document.model.enumerations.forEach((enumeration, index) => {
    if (enumeration.packageId && !packageIds.has(enumeration.packageId)) {
      diagnostics.push(error('MISSING_REFERENCE', `Enumeration package '${enumeration.packageId}' does not exist.`, `model.enumerations[${index}].packageId`, enumeration.id, 'UmlEnumeration'));
    }
  });

  document.layout.nodes.forEach((node, index) => {
    if (!semanticIds.has(node.elementId)) {
      diagnostics.push(error('MISSING_LAYOUT_REFERENCE', `Layout node references missing element '${node.elementId}'.`, `layout.nodes[${index}].elementId`, node.id, 'DiagramNodeLayout'));
    }
  });

  return diagnostics;
}

function validateTypeReferences(
  refs: Array<{ ownerId: Uuid; ownerType: string; type: { kind: string; classId?: Uuid; enumerationId?: Uuid; name?: string }; path: string }>,
  classIds: Set<Uuid>,
  enumerationIds: Set<Uuid>,
  diagnostics: ValidationDiagnostic[],
) {
  refs.forEach((ref) => {
    if (ref.type.kind === 'class' && (!ref.type.classId || !classIds.has(ref.type.classId))) {
      diagnostics.push(error('MISSING_REFERENCE', `Type references missing class '${ref.type.classId ?? ''}'.`, ref.path, ref.ownerId, ref.ownerType));
    }
    if (ref.type.kind === 'enumeration' && (!ref.type.enumerationId || !enumerationIds.has(ref.type.enumerationId))) {
      diagnostics.push(error('MISSING_REFERENCE', `Type references missing enumeration '${ref.type.enumerationId ?? ''}'.`, ref.path, ref.ownerId, ref.ownerType));
    }
    if (ref.type.kind === 'custom' && !ref.type.name?.trim()) {
      diagnostics.push(error('INVALID_TYPE', 'Custom type name is required.', ref.path, ref.ownerId, ref.ownerType));
    }
  });
}

function validateRelationships(document: ProjectDocument): ValidationDiagnostic[] {
  const classIds = new Set(document.model.classes.map((umlClass) => umlClass.id));
  return document.model.relationships.flatMap((relationship, index) => validateRelationship(relationship, index, classIds));
}

function validateRelationship(relationship: UmlRelationship, index: number, classIds: Set<Uuid>): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const basePath = `model.relationships[${index}]`;

  if (!relationship.source?.classId) {
    diagnostics.push(error('MALFORMED_RELATIONSHIP', 'Relationship source endpoint is required.', `${basePath}.source`, relationship.id, 'UmlRelationship'));
  } else if (!classIds.has(relationship.source.classId)) {
    diagnostics.push(error('MISSING_REFERENCE', `Relationship source class '${relationship.source.classId}' does not exist.`, `${basePath}.source.classId`, relationship.id, 'UmlRelationship'));
  }

  if (!relationship.target?.classId) {
    diagnostics.push(error('MALFORMED_RELATIONSHIP', 'Relationship target endpoint is required.', `${basePath}.target`, relationship.id, 'UmlRelationship'));
  } else if (!classIds.has(relationship.target.classId)) {
    diagnostics.push(error('MISSING_REFERENCE', `Relationship target class '${relationship.target.classId}' does not exist.`, `${basePath}.target.classId`, relationship.id, 'UmlRelationship'));
  }

  if (relationship.kind === 'generalization' && relationship.source?.classId === relationship.target?.classId) {
    diagnostics.push(error('INVALID_GENERALIZATION', 'Generalization source and target must be different classes.', `${basePath}.target.classId`, relationship.id, 'UmlRelationship'));
  }

  if (relationship.kind !== 'generalization') {
    validateMultiplicity(relationship.source?.multiplicity, `${basePath}.source.multiplicity`, relationship.id, diagnostics);
    validateMultiplicity(relationship.target?.multiplicity, `${basePath}.target.multiplicity`, relationship.id, diagnostics);
  }

  return diagnostics;
}

function validateMultiplicity(multiplicity: Multiplicity | undefined, path: string, relationshipId: Uuid, diagnostics: ValidationDiagnostic[]) {
  if (!multiplicity) {
    return;
  }

  const lowerValid = Number.isInteger(multiplicity.lower) && multiplicity.lower >= 0;
  const upperValid = multiplicity.upper === '*' || (Number.isInteger(multiplicity.upper) && multiplicity.upper >= 0);
  if (!lowerValid || !upperValid) {
    diagnostics.push(error('INVALID_MULTIPLICITY', 'Multiplicity bounds must be non-negative integers or upper *.', path, relationshipId, 'UmlRelationship'));
    return;
  }

  if (typeof multiplicity.upper === 'number' && multiplicity.lower > multiplicity.upper) {
    diagnostics.push(error('INVALID_MULTIPLICITY', 'Multiplicity lower bound must not exceed numeric upper bound.', path, relationshipId, 'UmlRelationship'));
  }
}

function validateWarnings(document: ProjectDocument): ValidationDiagnostic[] {
  return document.model.classes.flatMap((umlClass, index) => {
    if (!umlClass.name || /^[A-Z]/.test(umlClass.name)) {
      return [];
    }
    return [warning('CLASS_NAME_NOT_UPPERCASE', 'Class names should start with an uppercase letter.', `model.classes[${index}].name`, umlClass.id, 'UmlClass')];
  });
}
