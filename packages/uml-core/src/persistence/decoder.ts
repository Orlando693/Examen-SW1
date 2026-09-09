import type { ProjectDocument } from '../model/document.js';
import type { DiagramLayout } from '../model/layout.js';
import type { CanonicalUmlModel } from '../model/model.js';
import type { Multiplicity, UmlRelationship, UmlRelationshipEndpoint } from '../model/relationships.js';
import type {
  GenerationMetadata,
  UmlAttribute,
  UmlClass,
  UmlEnumeration,
  UmlEnumerationLiteral,
  UmlOperation,
  UmlOperationParameter,
  UmlPackage,
  UmlTypeRef,
  PrimitiveTypeName,
  Visibility,
} from '../model/types.js';
import {
  INITIAL_DOCUMENT_SCHEMA_VERSION,
  type DecodeResult,
  type ProjectResource,
  type StructuralDiagnostic,
} from './project-resource.js';

type UnknownRecord = Record<string, unknown>;

const VISIBILITIES = new Set(['public', 'private', 'protected', 'package']);
const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean', 'date', 'datetime', 'void']);
const RELATIONSHIP_KINDS = new Set(['association', 'aggregation', 'composition', 'generalization']);

class Decoder {
  readonly diagnostics: StructuralDiagnostic[] = [];

  decodeProjectDocument(input: unknown): ProjectDocument | undefined {
    const value = this.record(input, 'project');
    if (!value) {
      return undefined;
    }

    const id = this.string(value, 'id', 'project.id');
    const metadataRecord = this.recordField(value, 'metadata', 'project.metadata');
    const name = metadataRecord ? this.string(metadataRecord, 'name', 'project.metadata.name') : undefined;
    const description = metadataRecord ? this.optionalString(metadataRecord, 'description', 'project.metadata.description') : undefined;
    const ownerId = this.optionalString(value, 'ownerId', 'project.ownerId');
    const revision = this.nonNegativeInteger(value, 'revision', 'project.revision');
    const timestampsRecord = this.recordField(value, 'timestamps', 'project.timestamps');
    const createdAt = timestampsRecord ? this.string(timestampsRecord, 'createdAt', 'project.timestamps.createdAt') : undefined;
    const updatedAt = timestampsRecord ? this.string(timestampsRecord, 'updatedAt', 'project.timestamps.updatedAt') : undefined;
    const model = this.decodeModel(value.model, 'project.model');
    const layout = this.decodeLayout(value.layout, 'project.layout');

    if (!id || name === undefined || revision === undefined || !createdAt || !updatedAt || !model || !layout || !metadataRecord) {
      return undefined;
    }

    return {
      id,
      metadata: {
        name,
        ...(description === undefined ? {} : { description }),
      },
      ...(ownerId === undefined ? {} : { ownerId }),
      revision,
      timestamps: { createdAt, updatedAt },
      model,
      layout,
    };
  }

  decodeProjectResource(input: unknown): ProjectResource | undefined {
    const value = this.record(input, 'resource');
    if (!value) {
      return undefined;
    }

    const documentSchemaVersion = this.nonNegativeInteger(value, 'documentSchemaVersion', 'resource.documentSchemaVersion');
    if (documentSchemaVersion !== undefined && documentSchemaVersion !== INITIAL_DOCUMENT_SCHEMA_VERSION) {
      this.diagnostics.push({
        code: 'UNSUPPORTED_DOCUMENT_SCHEMA_VERSION',
        message: `Document schema version '${documentSchemaVersion}' is not supported.`,
        path: 'resource.documentSchemaVersion',
      });
    }

    const storageVersion = this.nonNegativeInteger(value, 'storageVersion', 'resource.storageVersion');
    const project = this.decodeProjectDocument(value.project);
    if (documentSchemaVersion === undefined || documentSchemaVersion !== INITIAL_DOCUMENT_SCHEMA_VERSION || storageVersion === undefined || !project) {
      return undefined;
    }

    return { project, storageVersion, documentSchemaVersion };
  }

  private decodeModel(input: unknown, path: string): CanonicalUmlModel | undefined {
    const value = this.record(input, path);
    if (!value) {
      return undefined;
    }
    const packages = this.arrayField(value, 'packages', `${path}.packages`, (entry, index) => this.decodePackage(entry, `${path}.packages[${index}]`));
    const classes = this.arrayField(value, 'classes', `${path}.classes`, (entry, index) => this.decodeClass(entry, `${path}.classes[${index}]`));
    const enumerations = this.arrayField(value, 'enumerations', `${path}.enumerations`, (entry, index) => this.decodeEnumeration(entry, `${path}.enumerations[${index}]`));
    const relationships = this.arrayField(value, 'relationships', `${path}.relationships`, (entry, index) => this.decodeRelationship(entry, `${path}.relationships[${index}]`));
    if (!packages || !classes || !enumerations || !relationships) {
      return undefined;
    }
    return { packages, classes, enumerations, relationships };
  }

  private decodeLayout(input: unknown, path: string): DiagramLayout | undefined {
    const value = this.record(input, path);
    if (!value) {
      return undefined;
    }
    const nodes = this.arrayField(value, 'nodes', `${path}.nodes`, (entry, index) => {
      const node = this.record(entry, `${path}.nodes[${index}]`);
      if (!node) return undefined;
      const id = this.string(node, 'id', `${path}.nodes[${index}].id`);
      const elementId = this.string(node, 'elementId', `${path}.nodes[${index}].elementId`);
      const position = this.recordField(node, 'position', `${path}.nodes[${index}].position`);
      const x = position ? this.number(position, 'x', `${path}.nodes[${index}].position.x`) : undefined;
      const y = position ? this.number(position, 'y', `${path}.nodes[${index}].position.y`) : undefined;
      const size = this.optionalRecord(node, 'size', `${path}.nodes[${index}].size`);
      const width = size ? this.number(size, 'width', `${path}.nodes[${index}].size.width`) : undefined;
      const height = size ? this.number(size, 'height', `${path}.nodes[${index}].size.height`) : undefined;
      if (!id || !elementId || x === undefined || y === undefined || (size && (width === undefined || height === undefined))) return undefined;
      return { id, elementId, position: { x, y }, ...(size ? { size: { width: width!, height: height! } } : {}) };
    });
    return nodes ? { nodes } : undefined;
  }

  private decodePackage(input: unknown, path: string): UmlPackage | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const name = this.string(value, 'name', `${path}.name`);
    const parentPackageId = this.optionalString(value, 'parentPackageId', `${path}.parentPackageId`);
    const generation = this.decodeGeneration(value.generation, `${path}.generation`);
    if (!id || name === undefined) return undefined;
    return { id, name, ...(parentPackageId === undefined ? {} : { parentPackageId }), ...(generation === undefined ? {} : { generation }) };
  }

  private decodeClass(input: unknown, path: string): UmlClass | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const name = this.string(value, 'name', `${path}.name`);
    const packageId = this.optionalString(value, 'packageId', `${path}.packageId`);
    const attributes = this.arrayField(value, 'attributes', `${path}.attributes`, (entry, index) => this.decodeAttribute(entry, `${path}.attributes[${index}]`));
    const operations = this.arrayField(value, 'operations', `${path}.operations`, (entry, index) => this.decodeOperation(entry, `${path}.operations[${index}]`));
    const generation = this.decodeGeneration(value.generation, `${path}.generation`);
    if (!id || name === undefined || !attributes || !operations) return undefined;
    return { id, name, ...(packageId === undefined ? {} : { packageId }), attributes, operations, ...(generation === undefined ? {} : { generation }) };
  }

  private decodeAttribute(input: unknown, path: string): UmlAttribute | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const name = this.string(value, 'name', `${path}.name`);
    const type = this.decodeType(value.type, `${path}.type`);
    const visibility = this.visibility(value.visibility, `${path}.visibility`);
    const generation = this.decodeGeneration(value.generation, `${path}.generation`);
    if (!id || name === undefined || !type || !visibility) return undefined;
    return { id, name, type, visibility, ...(generation === undefined ? {} : { generation }) };
  }

  private decodeOperation(input: unknown, path: string): UmlOperation | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const name = this.string(value, 'name', `${path}.name`);
    const returnType = this.decodeType(value.returnType, `${path}.returnType`);
    const visibility = this.visibility(value.visibility, `${path}.visibility`);
    const parameters = this.arrayField(value, 'parameters', `${path}.parameters`, (entry, index) => this.decodeParameter(entry, `${path}.parameters[${index}]`));
    const generation = this.decodeGeneration(value.generation, `${path}.generation`);
    if (!id || name === undefined || !returnType || !visibility || !parameters) return undefined;
    return { id, name, returnType, visibility, parameters, ...(generation === undefined ? {} : { generation }) };
  }

  private decodeParameter(input: unknown, path: string): UmlOperationParameter | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const name = this.string(value, 'name', `${path}.name`);
    const type = this.decodeType(value.type, `${path}.type`);
    return id && name !== undefined && type ? { id, name, type } : undefined;
  }

  private decodeEnumeration(input: unknown, path: string): UmlEnumeration | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const name = this.string(value, 'name', `${path}.name`);
    const packageId = this.optionalString(value, 'packageId', `${path}.packageId`);
    const literals = this.arrayField(value, 'literals', `${path}.literals`, (entry, index) => this.decodeLiteral(entry, `${path}.literals[${index}]`));
    const generation = this.decodeGeneration(value.generation, `${path}.generation`);
    if (!id || name === undefined || !literals) return undefined;
    return { id, name, ...(packageId === undefined ? {} : { packageId }), literals, ...(generation === undefined ? {} : { generation }) };
  }

  private decodeLiteral(input: unknown, path: string): UmlEnumerationLiteral | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const name = this.string(value, 'name', `${path}.name`);
    const generation = this.decodeGeneration(value.generation, `${path}.generation`);
    return id && name !== undefined ? { id, name, ...(generation === undefined ? {} : { generation }) } : undefined;
  }

  private decodeRelationship(input: unknown, path: string): UmlRelationship | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const id = this.string(value, 'id', `${path}.id`);
    const kind = this.discriminator(value, 'kind', RELATIONSHIP_KINDS, `${path}.kind`);
    const name = this.optionalString(value, 'name', `${path}.name`);
    const source = this.decodeEndpoint(value.source, `${path}.source`);
    const target = this.decodeEndpoint(value.target, `${path}.target`);
    if (!id || !kind || !source || !target) return undefined;
    if (kind === 'generalization') {
      return { id, kind, ...(name === undefined ? {} : { name }), source, target };
    }
    return { id, kind: kind as 'association' | 'aggregation' | 'composition', ...(name === undefined ? {} : { name }), source, target };
  }

  private decodeEndpoint(input: unknown, path: string): UmlRelationshipEndpoint | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const classId = this.string(value, 'classId', `${path}.classId`);
    const roleName = this.optionalString(value, 'roleName', `${path}.roleName`);
    const multiplicity = value.multiplicity === undefined ? undefined : this.decodeMultiplicity(value.multiplicity, `${path}.multiplicity`);
    return classId ? { classId, ...(roleName === undefined ? {} : { roleName }), ...(multiplicity === undefined ? {} : { multiplicity }) } : undefined;
  }

  private decodeMultiplicity(input: unknown, path: string): Multiplicity | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const lower = this.number(value, 'lower', `${path}.lower`);
    const upper: number | '*' | undefined = value.upper === '*' ? '*' : this.number(value, 'upper', `${path}.upper`);
    return lower === undefined || upper === undefined ? undefined : { lower, upper };
  }

  private decodeType(input: unknown, path: string): UmlTypeRef | undefined {
    const value = this.record(input, path);
    if (!value) return undefined;
    const kind = this.discriminator(value, 'kind', new Set(['primitive', 'class', 'enumeration', 'custom']), `${path}.kind`);
    if (!kind) return undefined;
    if (kind === 'primitive') {
      const name = this.discriminator(value, 'name', PRIMITIVE_TYPES, `${path}.name`);
      return name ? { kind, name: name as PrimitiveTypeName } : undefined;
    }
    if (kind === 'class') {
      const classId = this.string(value, 'classId', `${path}.classId`);
      return classId ? { kind: 'class', classId } : undefined;
    }
    if (kind === 'enumeration') {
      const enumerationId = this.string(value, 'enumerationId', `${path}.enumerationId`);
      return enumerationId ? { kind: 'enumeration', enumerationId } : undefined;
    }
    const name = this.string(value, 'name', `${path}.name`);
    return name === undefined ? undefined : { kind: 'custom', name };
  }

  private decodeGeneration(input: unknown, path: string): GenerationMetadata | undefined {
    if (input === undefined) return undefined;
    const value = this.record(input, path);
    if (!value) return undefined;
    const result: GenerationMetadata = {};
    for (const field of ['entity', 'auditable', 'readOnly', 'searchable', 'crud', 'required', 'unique', 'sortable'] as const) {
      if (value[field] !== undefined) {
        if (typeof value[field] !== 'boolean') {
          this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected boolean.', path: `${path}.${field}` });
        } else {
          result[field] = value[field];
        }
      }
    }
    if (value.defaultSort !== undefined) {
      if (value.defaultSort !== 'asc' && value.defaultSort !== 'desc') {
        this.diagnostics.push({ code: 'UNSUPPORTED_DISCRIMINATOR', message: "Expected 'asc' or 'desc'.", path: `${path}.defaultSort` });
      } else {
        result.defaultSort = value.defaultSort;
      }
    }
    return result;
  }

  private arrayField<T>(value: UnknownRecord, key: string, path: string, decode: (entry: unknown, index: number) => T | undefined): T[] | undefined {
    const input = value[key];
    if (input === undefined) {
      this.diagnostics.push({ code: 'MISSING_FIELD', message: 'Required field is missing.', path });
      return undefined;
    }
    if (!Array.isArray(input)) {
      this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected array.', path });
      return undefined;
    }
    const result = input.map(decode);
    return result.some((entry) => entry === undefined) ? undefined : result as T[];
  }

  private record(input: unknown, path: string): UnknownRecord | undefined {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected object.', path });
      return undefined;
    }
    return input as UnknownRecord;
  }

  private recordField(value: UnknownRecord, key: string, path: string): UnknownRecord | undefined {
    if (!(key in value)) {
      this.diagnostics.push({ code: 'MISSING_FIELD', message: 'Required field is missing.', path });
      return undefined;
    }
    return this.record(value[key], path);
  }

  private optionalRecord(value: UnknownRecord, key: string, path: string): UnknownRecord | undefined {
    return value[key] === undefined ? undefined : this.record(value[key], path);
  }

  private string(value: UnknownRecord, key: string, path: string): string | undefined {
    if (!(key in value)) {
      this.diagnostics.push({ code: 'MISSING_FIELD', message: 'Required field is missing.', path });
      return undefined;
    }
    if (typeof value[key] !== 'string') {
      this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected string.', path });
      return undefined;
    }
    return value[key];
  }

  private optionalString(value: UnknownRecord, key: string, path: string): string | undefined {
    if (value[key] === undefined) return undefined;
    if (typeof value[key] !== 'string') {
      this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected string.', path });
      return undefined;
    }
    return value[key];
  }

  private number(value: UnknownRecord, key: string, path: string): number | undefined {
    if (!(key in value)) {
      this.diagnostics.push({ code: 'MISSING_FIELD', message: 'Required field is missing.', path });
      return undefined;
    }
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected finite number.', path });
      return undefined;
    }
    return value[key];
  }

  private nonNegativeInteger(value: UnknownRecord, key: string, path: string): number | undefined {
    const number = this.number(value, key, path);
    if (number !== undefined && (!Number.isInteger(number) || number < 0)) {
      this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected non-negative integer.', path });
      return undefined;
    }
    return number;
  }

  private visibility(input: unknown, path: string) {
    return this.discriminatorValue(input, VISIBILITIES, path) as Visibility | undefined;
  }

  private discriminator(value: UnknownRecord, key: string, allowed: Set<string>, path: string): string | undefined {
    if (!(key in value)) {
      this.diagnostics.push({ code: 'MISSING_FIELD', message: 'Required discriminator is missing.', path });
      return undefined;
    }
    return this.discriminatorValue(value[key], allowed, path);
  }

  private discriminatorValue(input: unknown, allowed: Set<string>, path: string): string | undefined {
    if (typeof input !== 'string') {
      this.diagnostics.push({ code: 'INVALID_TYPE', message: 'Expected string discriminator.', path });
      return undefined;
    }
    if (!allowed.has(input)) {
      this.diagnostics.push({ code: 'UNSUPPORTED_DISCRIMINATOR', message: `Unsupported discriminator '${input}'.`, path });
      return undefined;
    }
    return input;
  }
}

export function decodeProjectDocument(input: unknown): DecodeResult<ProjectDocument> {
  const decoder = new Decoder();
  const value = decoder.decodeProjectDocument(input);
  return value && decoder.diagnostics.length === 0 ? { ok: true, value } : { ok: false, diagnostics: decoder.diagnostics };
}

export function decodeProjectResource(input: unknown): DecodeResult<ProjectResource> {
  const decoder = new Decoder();
  const value = decoder.decodeProjectResource(input);
  return value && decoder.diagnostics.length === 0 ? { ok: true, value } : { ok: false, diagnostics: decoder.diagnostics };
}

export function decodeSerializedProjectDocument(serialized: string): DecodeResult<ProjectDocument> {
  try {
    return decodeProjectDocument(JSON.parse(serialized));
  } catch {
    return {
      ok: false,
      diagnostics: [{ code: 'MALFORMED_JSON', message: 'Serialized project document is not valid JSON.', path: '$' }],
    };
  }
}
