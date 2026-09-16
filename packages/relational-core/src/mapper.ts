import type { CanonicalUmlModel, Multiplicity, UmlAttribute, UmlClass, UmlRelationship } from '@examen-sw1/uml-core';
import { derivedName, sqlName } from './naming.js';
import type {
  RelationalColumn, RelationalDiagnostic, RelationalEnum, RelationalForeignKey, RelationalGenerationMetadata,
  RelationalMappingResult, RelationalRelation, RelationalSqlType, RelationalTable,
} from './types.js';

const sortByName = <T extends { id: string; name: string }>(values: T[]) => [...values].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
const error = (code: string, message: string, path: string, sourceElementId?: string): RelationalDiagnostic => ({ severity: 'ERROR', code, message, path, ...(sourceElementId ? { sourceElementId } : {}) });
const isMany = (multiplicity: Multiplicity | undefined) => multiplicity?.upper === '*';
const isOne = (multiplicity: Multiplicity | undefined) => multiplicity?.upper === 1;

interface State {
  diagnostics: RelationalDiagnostic[];
  model: CanonicalUmlModel;
  tables: Map<string, RelationalTable>;
  tableNames: Set<string>;
  constraintNames: Set<string>;
  relations: RelationalRelation[];
}

function addDiagnostic(state: State, code: string, message: string, path: string, sourceId?: string) {
  state.diagnostics.push(error(code, message, path, sourceId));
}

function columnId(tableId: string, value: string) { return `column:${tableId}:${value}`; }
function tableId(classId: string) { return `table:${classId}`; }
function primaryKeyName(table: RelationalTable): string { return table.primaryKey.columnIds[0] ?? ''; }
function findColumn(table: RelationalTable, id: string) { return table.columns.find((column) => column.id === id); }
function sortTable(table: RelationalTable) {
  table.columns.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  table.foreignKeys.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  table.uniqueConstraints.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  table.indexes.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  table.checkConstraints.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function scalarType(attribute: UmlAttribute): { sqlType: RelationalSqlType; javaType: RelationalColumn['javaType'] } | undefined {
  if (attribute.type.kind === 'primitive') {
    switch (attribute.type.name) {
      case 'string': return { sqlType: 'VARCHAR(255)', javaType: 'String' };
      case 'number': return { sqlType: 'NUMERIC', javaType: 'BigDecimal' };
      case 'boolean': return { sqlType: 'BOOLEAN', javaType: 'Boolean' };
      case 'date': return { sqlType: 'DATE', javaType: 'LocalDate' };
      case 'datetime': return { sqlType: 'TIMESTAMP WITH TIME ZONE', javaType: 'Instant' };
      default: return undefined;
    }
  }
  if (attribute.type.kind === 'enumeration') return { sqlType: 'VARCHAR(255)', javaType: 'String' };
  return undefined;
}

function validateSource(state: State, metadata: RelationalGenerationMetadata) {
  const classIds = new Set(state.model.classes.map((item) => item.id));
  const enumIds = new Set(state.model.enumerations.map((item) => item.id));
  const attributeIds = new Set(state.model.classes.flatMap((item) => item.attributes.map((attribute) => attribute.id)));
  for (const [index, hint] of (metadata.identifiers ?? []).entries()) {
    const clazz = state.model.classes.find((item) => item.id === hint.classId);
    if (!clazz || !attributeIds.has(hint.attributeId) || !clazz.attributes.some((attribute) => attribute.id === hint.attributeId)) {
      addDiagnostic(state, 'INVALID_IDENTIFIER_METADATA', 'Identifier metadata must reference an attribute of its declared class.', `metadata.identifiers[${index}]`, hint.classId);
    }
  }
  for (const clazz of state.model.classes) {
    if (!clazz.name.trim()) addDiagnostic(state, 'INVALID_NAME', 'Class name is required.', 'classes', clazz.id);
    for (const attribute of clazz.attributes) {
      if (!attribute.name.trim()) addDiagnostic(state, 'INVALID_NAME', 'Attribute name is required.', 'attributes', attribute.id);
      if (!scalarType(attribute)) addDiagnostic(state, 'UNSUPPORTED_ATTRIBUTE_TYPE', 'Only supported primitive and enumeration attributes are persistible.', 'attributes', attribute.id);
      if (attribute.type.kind === 'enumeration' && !enumIds.has(attribute.type.enumerationId)) addDiagnostic(state, 'UNRESOLVED_REFERENCE', 'Attribute enum reference does not exist.', 'attributes', attribute.id);
    }
  }
  for (const enumeration of state.model.enumerations) {
    if (!enumeration.name.trim() || enumeration.literals.length === 0 || enumeration.literals.some((literal) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(literal.name))) {
      addDiagnostic(state, 'INVALID_ENUM_REPRESENTATION', 'Enumeration names and literals must be non-empty Java identifiers.', 'enumerations', enumeration.id);
    }
  }
  for (const relationship of state.model.relationships) {
    if (!classIds.has(relationship.source.classId) || !classIds.has(relationship.target.classId)) addDiagnostic(state, 'UNRESOLVED_REFERENCE', 'Relationship endpoint does not exist.', 'relationships', relationship.id);
    if (relationship.kind !== 'generalization') {
      for (const endpoint of [relationship.source, relationship.target]) {
        if (!endpoint.multiplicity || (!isOne(endpoint.multiplicity) && !isMany(endpoint.multiplicity))) addDiagnostic(state, 'MALFORMED_MULTIPLICITY', 'Only multiplicity upper bounds 1 and * are supported.', 'relationships', relationship.id);
      }
    }
  }
}

function inheritanceParents(state: State): Map<string, string> {
  const parents = new Map<string, string>();
  for (const relationship of state.model.relationships.filter((item) => item.kind === 'generalization')) {
    const child = relationship.source.classId;
    const parent = relationship.target.classId;
    if (parents.has(child)) addDiagnostic(state, 'MULTIPLE_INHERITANCE', 'A class can have only one persistent parent.', 'relationships', relationship.id);
    else parents.set(child, parent);
  }
  for (const child of parents.keys()) {
    const seen = new Set<string>();
    let current: string | undefined = child;
    while (current) {
      if (seen.has(current)) { addDiagnostic(state, 'INHERITANCE_CYCLE', 'Generalization hierarchy contains a cycle.', 'relationships', child); break; }
      seen.add(current);
      current = parents.get(current);
    }
  }
  return parents;
}

function createEnums(state: State): RelationalEnum[] {
  const used = new Set<string>();
  return sortByName(state.model.enumerations).flatMap((enumeration) => {
    const name = sqlName(enumeration.name, enumeration.id, used);
    if (!name) { addDiagnostic(state, 'IMPOSSIBLE_NAMING', 'Enumeration SQL name cannot be resolved.', 'enumerations', enumeration.id); return []; }
    return [{ id: `enum:${enumeration.id}`, name, sourceEnumerationId: enumeration.id, literals: sortByName(enumeration.literals).map((literal) => literal.name) }];
  });
}

function createTables(state: State, metadata: RelationalGenerationMetadata, parents: Map<string, string>) {
  const hints = metadata.identifiers ?? [];
  for (const clazz of sortByName(state.model.classes)) {
    const name = sqlName(clazz.name, clazz.id, state.tableNames);
    if (!name) { addDiagnostic(state, 'IMPOSSIBLE_NAMING', 'Table SQL name cannot be resolved.', 'classes', clazz.id); continue; }
    const table: RelationalTable = { id: tableId(clazz.id), name, kind: 'ENTITY', sourceClassId: clazz.id, columns: [], primaryKey: { name: '', columnIds: [] }, foreignKeys: [], uniqueConstraints: [], indexes: [], checkConstraints: [] };
    state.tables.set(clazz.id, table);
    if (!parents.has(clazz.id)) createPrimaryKey(state, table, clazz, hints.filter((hint) => hint.classId === clazz.id));
  }
  const pending = [...parents.entries()].sort(([left], [right]) => left.localeCompare(right));
  while (pending.length > 0) {
    const index = pending.findIndex(([, parentId]) => (state.tables.get(parentId)?.primaryKey.columnIds.length ?? 0) > 0);
    if (index < 0) break;
    const [childId, parentId] = pending.splice(index, 1)[0];
    const child = state.tables.get(childId);
    const parent = state.tables.get(parentId);
    if (!child || !parent) continue;
    const parentColumn = findColumn(parent, primaryKeyName(parent));
    if (!parentColumn) continue;
    const copied: RelationalColumn = { ...parentColumn, id: columnId(child.id, parentColumn.name), name: parentColumn.name, generated: false, nullable: false };
    child.columns.push(copied);
    child.primaryKey = { name: derivedName('pk', [child.name], child.id, state.constraintNames) ?? `pk_${child.name}`, columnIds: [copied.id] };
    addForeignKey(state, child, [copied.id], parent, [parentColumn.id], 'NO ACTION', `inheritance:${childId}`);
    state.relations.push({ id: `relation:inheritance:${childId}`, kind: 'INHERITANCE', sourceRelationshipId: state.model.relationships.find((item) => item.kind === 'generalization' && item.source.classId === childId)?.id ?? childId, tableIds: [child.id, parent.id], ownerTableId: child.id });
  }
}

function createPrimaryKey(state: State, table: RelationalTable, clazz: UmlClass, hints: RelationalGenerationMetadata['identifiers']) {
  if ((hints?.length ?? 0) > 1) { addDiagnostic(state, 'INVALID_IDENTIFIER_METADATA', 'A class has more than one identifier hint.', 'metadata.identifiers', clazz.id); return; }
  const hint = hints?.[0];
  const attribute = hint ? clazz.attributes.find((item) => item.id === hint.attributeId) : undefined;
  const used = new Set<string>();
  if (hint && (!attribute || attribute.type.kind !== 'primitive' || attribute.type.name !== 'number')) {
    addDiagnostic(state, 'INVALID_IDENTIFIER_METADATA', 'An explicit identifier must be a number attribute.', 'metadata.identifiers', clazz.id); return;
  }
  const columnName = sqlName(attribute?.name ?? 'id', attribute?.id ?? `${clazz.id}:synthetic`, used);
  if (!columnName) { addDiagnostic(state, 'IMPOSSIBLE_NAMING', 'Primary key column name cannot be resolved.', 'classes', clazz.id); return; }
  const column: RelationalColumn = { id: columnId(table.id, columnName), name: columnName, sqlType: 'BIGINT', javaType: 'Long', nullable: false, generated: !attribute, ...(attribute ? { sourceAttributeId: attribute.id } : {}) };
  table.columns.push(column);
  table.primaryKey = { name: derivedName('pk', [table.name], table.id, state.constraintNames) ?? `pk_${table.name}`, columnIds: [column.id] };
}

function addAttributes(state: State, enums: RelationalEnum[], metadata: RelationalGenerationMetadata) {
  const enumMap = new Map(enums.map((item) => [item.sourceEnumerationId, item]));
  const hints = new Set((metadata.identifiers ?? []).map((hint) => hint.attributeId));
  for (const clazz of state.model.classes) {
    const table = state.tables.get(clazz.id);
    if (!table) continue;
    const used = new Set(table.columns.map((column) => column.name));
    for (const attribute of sortByName(clazz.attributes)) {
      if (hints.has(attribute.id)) continue;
      const type = scalarType(attribute);
      const name = sqlName(attribute.name, attribute.id, used);
      if (!type || !name) continue;
      const column: RelationalColumn = { id: columnId(table.id, name), name, ...type, nullable: attribute.generation?.required !== true, generated: false, sourceAttributeId: attribute.id, ...(attribute.type.kind === 'enumeration' ? { enumId: `enum:${attribute.type.enumerationId}` } : {}) };
      table.columns.push(column);
      if (attribute.generation?.unique) addUnique(state, table, [column.id], attribute.id);
      if (attribute.type.kind === 'enumeration') {
        const enumeration = enumMap.get(attribute.type.enumerationId);
        if (enumeration) {
          const constraint = derivedName('ck', [table.name, column.name, 'enum'], attribute.id, state.constraintNames);
          if (constraint) table.checkConstraints.push({ id: `check:${attribute.id}`, name: constraint, expression: `${column.name} IN (${enumeration.literals.map((literal) => `'${literal.replace(/'/g, "''")}'`).join(', ')})` });
        }
      }
    }
  }
}

function addUnique(state: State, table: RelationalTable, columnIds: string[], sourceId: string) {
  const name = derivedName('uq', [table.name, ...columnIds.map((id) => findColumn(table, id)?.name ?? id)], sourceId, state.constraintNames);
  if (name) table.uniqueConstraints.push({ id: `unique:${sourceId}`, name, columnIds });
}
function addForeignKey(state: State, table: RelationalTable, columnIds: string[], target: RelationalTable, targetColumnIds: string[], onDelete: RelationalForeignKey['onDelete'], sourceId: string) {
  const name = derivedName('fk', [table.name, ...columnIds.map((id) => findColumn(table, id)?.name ?? id), target.name], sourceId, state.constraintNames);
  if (!name) return;
  const foreignKey: RelationalForeignKey = { id: `foreign-key:${sourceId}:${table.id}`, name, columnIds, referencedTableId: target.id, referencedColumnIds: targetColumnIds, onDelete };
  table.foreignKeys.push(foreignKey);
  const isCoveredByUniquePrefix = [...table.uniqueConstraints.map((item) => item.columnIds), table.primaryKey.columnIds]
    .some((constraintColumns) => constraintColumns.slice(0, columnIds.length).join('|') === columnIds.join('|'));
  if (!isCoveredByUniquePrefix) {
    const indexName = derivedName('ix', [table.name, ...columnIds.map((id) => findColumn(table, id)?.name ?? id)], sourceId, state.constraintNames);
    if (indexName) table.indexes.push({ id: `index:${sourceId}:${table.id}`, name: indexName, columnIds, unique: false });
  }
}

function mapRelationships(state: State) {
  for (const relationship of [...state.model.relationships].sort((a, b) => a.id.localeCompare(b.id))) {
    if (relationship.kind === 'generalization') continue;
    const source = state.tables.get(relationship.source.classId);
    const target = state.tables.get(relationship.target.classId);
    if (!source || !target || !relationship.source.multiplicity || !relationship.target.multiplicity) continue;
    if (relationship.kind === 'composition' && (relationship.source.classId === relationship.target.classId || !isOne(relationship.source.multiplicity))) {
      addDiagnostic(state, 'AMBIGUOUS_COMPOSITION', 'Composition requires an unambiguous source owner with multiplicity one.', 'relationships', relationship.id); continue;
    }
    if (isMany(relationship.source.multiplicity) && isMany(relationship.target.multiplicity)) {
      if (relationship.kind === 'composition') { addDiagnostic(state, 'UNSUPPORTED_COMPOSITION_MANY_TO_MANY', 'Composition many-to-many is unsupported.', 'relationships', relationship.id); continue; }
      addJoinTable(state, relationship, source, target); continue;
    }
    const sourceToTarget = isOne(relationship.source.multiplicity) && isMany(relationship.target.multiplicity);
    const targetToSource = isMany(relationship.source.multiplicity) && isOne(relationship.target.multiplicity);
    if (relationship.kind === 'composition' && isOne(relationship.source.multiplicity) && isOne(relationship.target.multiplicity)) addReference(state, relationship, source, target, relationship.target.multiplicity, true, 'ONE_TO_ONE', true);
    else if (sourceToTarget) addReference(state, relationship, target, source, relationship.source.multiplicity, relationship.kind === 'composition', 'ONE_TO_MANY');
    else if (targetToSource) addReference(state, relationship, source, target, relationship.target.multiplicity, relationship.kind === 'composition', 'ONE_TO_MANY');
    else {
      const ownerFirst = source.name.localeCompare(target.name) < 0 || (source.name === target.name && relationship.id.localeCompare('') > 0);
      const owner = ownerFirst ? source : target;
      const referenced = ownerFirst ? target : source;
      const targetMultiplicity = ownerFirst ? relationship.target.multiplicity : relationship.source.multiplicity;
      addReference(state, relationship, owner, referenced, targetMultiplicity, relationship.kind === 'composition', 'ONE_TO_ONE', true);
    }
  }
}

function addReference(state: State, relationship: UmlRelationship, owner: RelationalTable, referenced: RelationalTable, multiplicity: Multiplicity, composition: boolean, kind: RelationalRelation['kind'], unique = false) {
  const targetPk = primaryKeyName(referenced);
  const targetColumn = findColumn(referenced, targetPk);
  if (!targetColumn) return;
  const used = new Set(owner.columns.map((column) => column.name));
  const name = sqlName(`${referenced.name}_${targetColumn.name}`, `${relationship.id}:${owner.id}`, used);
  if (!name) { addDiagnostic(state, 'IMPOSSIBLE_NAMING', 'Foreign key column name cannot be resolved.', 'relationships', relationship.id); return; }
  const column: RelationalColumn = { id: columnId(owner.id, name), name, sqlType: targetColumn.sqlType, javaType: targetColumn.javaType, nullable: composition ? false : multiplicity.lower === 0, generated: false };
  owner.columns.push(column);
  if (unique) addUnique(state, owner, [column.id], relationship.id);
  addForeignKey(state, owner, [column.id], referenced, [targetColumn.id], composition ? 'CASCADE' : 'NO ACTION', relationship.id);
  state.relations.push({ id: `relation:${relationship.id}`, kind: relationship.kind === 'aggregation' ? 'AGGREGATION' : relationship.kind === 'composition' ? 'COMPOSITION' : kind, sourceRelationshipId: relationship.id, tableIds: [owner.id, referenced.id], ownerTableId: owner.id });
}

function addJoinTable(state: State, relationship: UmlRelationship, first: RelationalTable, second: RelationalTable) {
  if (first.id === second.id && (!relationship.source.roleName || !relationship.target.roleName || relationship.source.roleName === relationship.target.roleName)) {
    addDiagnostic(state, 'AMBIGUOUS_SELF_RELATION', 'Self many-to-many relations require distinct UML roles.', 'relationships', relationship.id); return;
  }
  const [left, right] = [first, second].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const name = sqlName(`${left.name}_${right.name}_${relationship.name ?? 'join'}`, relationship.id, state.tableNames);
  if (!name) { addDiagnostic(state, 'IMPOSSIBLE_NAMING', 'Join table name cannot be resolved.', 'relationships', relationship.id); return; }
  const table: RelationalTable = { id: `table:join:${relationship.id}`, name, kind: 'JOIN', columns: [], primaryKey: { name: '', columnIds: [] }, foreignKeys: [], uniqueConstraints: [], indexes: [], checkConstraints: [] };
  const columns = [left, right].map((target, index) => {
    const primary = findColumn(target, primaryKeyName(target));
    if (!primary) return undefined;
    const role = target === first ? relationship.source.roleName : relationship.target.roleName;
    const columnName = sqlName(`${role ?? target.name}_${primary.name}`, `${relationship.id}:${index}`, new Set(table.columns.map((column) => column.name)));
    if (!columnName) return undefined;
    return { target, primary, column: { id: columnId(table.id, columnName), name: columnName, sqlType: primary.sqlType, javaType: primary.javaType, nullable: false, generated: false } };
  });
  if (columns.some((item) => !item)) return;
  for (const item of columns) table.columns.push(item!.column);
  table.primaryKey = { name: derivedName('pk', [table.name], table.id, state.constraintNames) ?? `pk_${table.name}`, columnIds: columns.map((item) => item!.column.id) };
  for (const item of columns) addForeignKey(state, table, [item!.column.id], item!.target, [item!.primary.id], 'NO ACTION', `${relationship.id}:${item!.target.id}`);
  state.tables.set(table.id, table);
  state.relations.push({ id: `relation:${relationship.id}`, kind: 'MANY_TO_MANY', sourceRelationshipId: relationship.id, tableIds: [left.id, right.id, table.id], ownerTableId: table.id });
}

export function mapCanonicalUmlModel(model: CanonicalUmlModel, metadata: RelationalGenerationMetadata = {}): RelationalMappingResult {
  const state: State = { diagnostics: [], model, tables: new Map(), tableNames: new Set(), constraintNames: new Set(), relations: [] };
  validateSource(state, metadata);
  const parents = inheritanceParents(state);
  if (state.diagnostics.length > 0) return { success: false, diagnostics: state.diagnostics.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path) || (a.sourceElementId ?? '').localeCompare(b.sourceElementId ?? '')) };
  const enums = createEnums(state);
  createTables(state, metadata, parents);
  addAttributes(state, enums, metadata);
  mapRelationships(state);
  if (state.diagnostics.length > 0) return { success: false, diagnostics: state.diagnostics.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path) || (a.sourceElementId ?? '').localeCompare(b.sourceElementId ?? '')) };
  const tables = [...state.tables.values()];
  for (const table of tables) sortTable(table);
  return { success: true, model: { version: 1, enums: enums.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), tables: tables.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)), relations: state.relations.sort((a, b) => a.id.localeCompare(b.id)) }, diagnostics: [] };
}
