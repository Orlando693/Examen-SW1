export type DomainFieldType = 'boolean' | 'date' | 'datetime' | 'decimal' | 'enum' | 'integer' | 'string';
export interface DomainDiagnostic { code: string; message: string; path: string; }
export interface DomainField { id: string; name: string; type: DomainFieldType; nullable: boolean; generated: boolean; identifier: boolean; enumValues?: string[]; validations: string[]; searchable: boolean; sortable: boolean; filterable: boolean; }
export interface DomainRelation { id: string; kind: string; sourceEntityId: string; targetEntityId: string; cardinality: string; navigation: { source: boolean; target: boolean }; }
export interface DomainEntity { id: string; name: string; aliases: string[]; fields: DomainField[]; relationIds: string[]; crud: { create: boolean; read: boolean; update: boolean; delete: boolean; list: boolean; count: boolean }; pagination: boolean; filterFields: string[]; searchableFields: string[]; sortableFields: string[]; }
export interface DomainManifest { version: 1; entities: DomainEntity[]; relations: DomainRelation[]; }
