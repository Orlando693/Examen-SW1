import type { Uuid } from '../ids.js';

export type Visibility = 'public' | 'private' | 'protected' | 'package';

export type PrimitiveTypeName = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'void';

export type UmlTypeRef =
  | { kind: 'primitive'; name: PrimitiveTypeName }
  | { kind: 'class'; classId: Uuid }
  | { kind: 'enumeration'; enumerationId: Uuid }
  | { kind: 'custom'; name: string };

export interface GenerationMetadata {
  entity?: boolean;
  auditable?: boolean;
  readOnly?: boolean;
  searchable?: boolean;
  crud?: boolean;
  required?: boolean;
  unique?: boolean;
  sortable?: boolean;
  defaultSort?: 'asc' | 'desc';
}

export interface UmlPackage {
  id: Uuid;
  name: string;
  parentPackageId?: Uuid;
  generation?: GenerationMetadata;
}

export interface UmlAttribute {
  id: Uuid;
  name: string;
  type: UmlTypeRef;
  visibility: Visibility;
  generation?: GenerationMetadata;
}

export interface UmlOperationParameter {
  id: Uuid;
  name: string;
  type: UmlTypeRef;
}

export interface UmlOperation {
  id: Uuid;
  name: string;
  returnType: UmlTypeRef;
  visibility: Visibility;
  parameters: UmlOperationParameter[];
  generation?: GenerationMetadata;
}

export interface UmlClass {
  id: Uuid;
  name: string;
  packageId?: Uuid;
  attributes: UmlAttribute[];
  operations: UmlOperation[];
  generation?: GenerationMetadata;
}

export interface UmlEnumerationLiteral {
  id: Uuid;
  name: string;
  generation?: GenerationMetadata;
}

export interface UmlEnumeration {
  id: Uuid;
  name: string;
  packageId?: Uuid;
  literals: UmlEnumerationLiteral[];
  generation?: GenerationMetadata;
}

export const stringType = (): UmlTypeRef => ({ kind: 'primitive', name: 'string' });
export const voidType = (): UmlTypeRef => ({ kind: 'primitive', name: 'void' });
