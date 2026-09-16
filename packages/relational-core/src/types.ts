import type { CanonicalUmlModel, Uuid } from '@examen-sw1/uml-core';

export type RelationalSeverity = 'ERROR' | 'WARNING';
export type RelationalSqlType = 'BIGINT' | 'BOOLEAN' | 'DATE' | 'NUMERIC' | 'TIMESTAMP WITH TIME ZONE' | 'VARCHAR(255)';
export type RelationalJavaType = 'BigDecimal' | 'Boolean' | 'Instant' | 'LocalDate' | 'Long' | 'String';

export interface RelationalDiagnostic {
  severity: RelationalSeverity;
  code: string;
  message: string;
  path: string;
  sourceElementId?: Uuid;
  relationalElementId?: string;
}

export interface RelationalIdentifierHint { classId: Uuid; attributeId: Uuid; }
export interface RelationalGenerationMetadata { identifiers?: RelationalIdentifierHint[]; }

export interface RelationalColumn {
  id: string;
  name: string;
  sqlType: RelationalSqlType;
  javaType: RelationalJavaType;
  nullable: boolean;
  generated: boolean;
  sourceAttributeId?: Uuid;
  enumId?: Uuid;
}

export interface RelationalPrimaryKey { name: string; columnIds: string[]; }
export interface RelationalForeignKey {
  id: string;
  name: string;
  columnIds: string[];
  referencedTableId: string;
  referencedColumnIds: string[];
  onDelete: 'CASCADE' | 'NO ACTION';
}
export interface RelationalUniqueConstraint { id: string; name: string; columnIds: string[]; }
export interface RelationalIndex { id: string; name: string; columnIds: string[]; unique: boolean; }
export interface RelationalCheckConstraint { id: string; name: string; expression: string; }
export interface RelationalTable {
  id: string;
  name: string;
  kind: 'ENTITY' | 'JOIN';
  sourceClassId?: Uuid;
  columns: RelationalColumn[];
  primaryKey: RelationalPrimaryKey;
  foreignKeys: RelationalForeignKey[];
  uniqueConstraints: RelationalUniqueConstraint[];
  indexes: RelationalIndex[];
  checkConstraints: RelationalCheckConstraint[];
}
export interface RelationalEnum { id: string; name: string; sourceEnumerationId: Uuid; literals: string[]; }
export interface RelationalRelation {
  id: string;
  kind: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY' | 'AGGREGATION' | 'COMPOSITION' | 'INHERITANCE';
  sourceRelationshipId: Uuid;
  tableIds: string[];
  ownerTableId?: string;
}
export interface RelationalModel { version: 1; enums: RelationalEnum[]; tables: RelationalTable[]; relations: RelationalRelation[]; }
export type RelationalMappingResult =
  | { success: true; model: RelationalModel; diagnostics: RelationalDiagnostic[] }
  | { success: false; model?: undefined; diagnostics: RelationalDiagnostic[] };

export type RelationalMapper = (model: CanonicalUmlModel, metadata?: RelationalGenerationMetadata) => RelationalMappingResult;
