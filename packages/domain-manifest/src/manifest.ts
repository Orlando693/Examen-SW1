import type { RelationalColumn, RelationalModel, RelationalTable } from '@examen-sw1/relational-core';
import type { JsonObject, ValidatedOpenApiContract } from '@examen-sw1/generated-api-contracts';
import type { DomainDiagnostic, DomainEntity, DomainField, DomainManifest, DomainRelation } from './types.js';

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const javaType = (column: RelationalColumn): DomainField['type'] => {
  if (column.enumId) return 'enum';
  switch (column.javaType) { case 'Long': return 'integer'; case 'BigDecimal': return 'decimal'; case 'Boolean': return 'boolean'; case 'LocalDate': return 'date'; case 'Instant': return 'datetime'; case 'String': return 'string'; }
};
const apiPath = (table: RelationalTable) => `/api/${table.name}`;
const apiName = (value: string) => value.replace(/_+([a-zA-Z0-9])/g, (_, character: string) => character.toUpperCase());
const schemaForCreate = (contract: ValidatedOpenApiContract, table: RelationalTable): JsonObject | undefined => {
  const paths = contract.document.paths as JsonObject;
  const post = isObject(paths[apiPath(table)]) && isObject((paths[apiPath(table)] as JsonObject).post) ? (paths[apiPath(table)] as JsonObject).post as JsonObject : undefined;
  const schema = post && isObject(post.requestBody) && isObject(post.requestBody.content) && isObject((post.requestBody.content as JsonObject)['application/json']) ? ((post.requestBody.content as JsonObject)['application/json'] as JsonObject).schema : undefined;
  if (!isObject(schema) || typeof schema.$ref !== 'string') return isObject(schema) ? schema : undefined;
  const name = schema.$ref.split('/').at(-1);
  const schemas = isObject(contract.document.components) && isObject((contract.document.components as JsonObject).schemas) ? (contract.document.components as JsonObject).schemas as JsonObject : undefined;
  return name && schemas && isObject(schemas[name]) ? schemas[name] as JsonObject : undefined;
};
const compatible = (fieldType: DomainField['type'], schema: JsonObject) => (fieldType === 'integer' && schema.type === 'integer') || (fieldType === 'decimal' && schema.type === 'number') || (fieldType === 'boolean' && schema.type === 'boolean') || ((fieldType === 'string' || fieldType === 'enum') && schema.type === 'string') || (fieldType === 'date' && schema.type === 'string' && schema.format === 'date') || (fieldType === 'datetime' && schema.type === 'string' && schema.format === 'date-time');
const operations = (contract: ValidatedOpenApiContract, table: RelationalTable) => {
  const paths = contract.document.paths as JsonObject;
  const item = isObject(paths[apiPath(table)]) ? paths[apiPath(table)] as JsonObject : {};
  const id = isObject(paths[`${apiPath(table)}/{id}`]) ? paths[`${apiPath(table)}/{id}`] as JsonObject : {};
  const count = isObject(paths[`${apiPath(table)}/count`]) ? paths[`${apiPath(table)}/count`] as JsonObject : {};
  return { create: isObject(item.post), list: isObject(item.get), read: isObject(id.get), update: isObject(id.put), delete: isObject(id.delete), count: isObject(count.get) };
};

function field(column: RelationalColumn, table: RelationalTable, model: RelationalModel): DomainField {
  const enumeration = column.enumId ? model.enums.find((item) => item.id === column.enumId) : undefined;
  const identifier = table.primaryKey.columnIds.includes(column.id);
  const text = column.javaType === 'String' && !column.enumId;
  return { id: column.id, name: column.name, type: javaType(column), nullable: column.nullable, generated: column.generated, identifier, ...(enumeration ? { enumValues: [...enumeration.literals].sort() } : {}), validations: [...(!column.nullable ? ['required'] : []), ...(text ? ['maxLength:255'] : [])], searchable: text, sortable: !column.generated, filterable: !column.generated };
}

export function canonicalizeDomainManifest(manifest: DomainManifest): string { return JSON.stringify({ version: manifest.version, entities: [...manifest.entities].sort((a, b) => a.id.localeCompare(b.id)).map((entity) => ({ ...entity, aliases: [...entity.aliases].sort(), fields: [...entity.fields].sort((a, b) => a.id.localeCompare(b.id)), relationIds: [...entity.relationIds].sort(), filterFields: [...entity.filterFields].sort(), searchableFields: [...entity.searchableFields].sort(), sortableFields: [...entity.sortableFields].sort() })), relations: [...manifest.relations].sort((a, b) => a.id.localeCompare(b.id)) }); }

export function generateDomainManifest(model: RelationalModel, contract: ValidatedOpenApiContract): { manifest?: DomainManifest; diagnostics: DomainDiagnostic[] } {
  const diagnostics: DomainDiagnostic[] = [];
  const entities = model.tables.filter((table) => table.kind === 'ENTITY').sort((a, b) => a.id.localeCompare(b.id));
  const entityIds = new Set(entities.map((table) => table.id));
  const relations: DomainRelation[] = [];
  for (const relation of model.relations.filter((item) => item.kind !== 'INHERITANCE')) {
    const [sourceEntityId, targetEntityId] = relation.tableIds.filter((id) => entityIds.has(id));
    if (!sourceEntityId || !targetEntityId) { diagnostics.push({ code: 'UNMAPPABLE_RELATION', message: 'Relation does not connect two generated entities.', path: `relations.${relation.id}` }); continue; }
    relations.push({ id: relation.id, kind: relation.kind, sourceEntityId, targetEntityId, cardinality: relation.kind, navigation: { source: true, target: true } });
  }
  relations.sort((a, b) => a.id.localeCompare(b.id));
  const manifestEntities: DomainEntity[] = entities.map((table) => {
    const crud = operations(contract, table);
    if (Object.values(crud).some((available) => !available)) diagnostics.push({ code: 'API_CAPABILITY_MISMATCH', message: 'Relational entity does not have complete generated API capabilities.', path: `entities.${table.id}` });
    const fields = table.columns.map((column) => field(column, table, model)).sort((a, b) => a.id.localeCompare(b.id));
    const createSchema = schemaForCreate(contract, table);
    const apiProperties = createSchema && isObject(createSchema.properties) ? createSchema.properties : {};
    const foreignIds = new Set(table.foreignKeys.flatMap((foreignKey) => foreignKey.columnIds));
    for (const item of fields.filter((field) => !field.generated && !foreignIds.has(field.id))) {
      const candidate = apiProperties[apiName(item.name)];
      const property = isObject(candidate) ? candidate : undefined;
      if (!property || !compatible(item.type, property)) diagnostics.push({ code: 'API_FIELD_TYPE_MISMATCH', message: 'Relational field is missing or incompatible with its OpenAPI create DTO.', path: `entities.${table.id}.fields.${item.id}` });
    }
    return { id: table.id, name: table.name, aliases: [table.name], fields, relationIds: relations.filter((relation) => relation.sourceEntityId === table.id || relation.targetEntityId === table.id).map((relation) => relation.id), crud, pagination: crud.list, filterFields: fields.filter((item) => item.filterable).map((item) => item.name), searchableFields: fields.filter((item) => item.searchable).map((item) => item.name), sortableFields: fields.filter((item) => item.sortable).map((item) => item.name) };
  });
  if (diagnostics.length) return { diagnostics };
  return { manifest: JSON.parse(canonicalizeDomainManifest({ version: 1, entities: manifestEntities, relations })) as DomainManifest, diagnostics: [] };
}

export function validateDomainManifest(model: RelationalModel, contract: ValidatedOpenApiContract, manifest: DomainManifest): DomainDiagnostic[] {
  const generated = generateDomainManifest(model, contract);
  if (!generated.manifest) return generated.diagnostics;
  return canonicalizeDomainManifest(generated.manifest) === canonicalizeDomainManifest(manifest) ? [] : [{ code: 'MANIFEST_SOURCE_MISMATCH', message: 'Manifest does not match relational and API authorities.', path: 'manifest' }];
}
