import { describe, expect, it } from 'vitest';
import type { CanonicalUmlModel, UmlClass, UmlRelationship } from '@examen-sw1/uml-core';
import { mapCanonicalUmlModel } from '../src/index.js';

const primitive = (name: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'void') => ({ kind: 'primitive' as const, name });
const clazz = (id: string, name: string, attributes: UmlClass['attributes'] = []): UmlClass => ({ id, name, attributes, operations: [] });
const relation = (id: string, kind: UmlRelationship['kind'], source: string, sourceUpper: 1 | '*', target: string, targetUpper: 1 | '*'): UmlRelationship => ({ id, kind: kind as 'association', source: { classId: source, multiplicity: { lower: 1, upper: sourceUpper } }, target: { classId: target, multiplicity: { lower: 0, upper: targetUpper } } });
const model = (classes: UmlClass[], relationships: UmlRelationship[] = [], enumerations: CanonicalUmlModel['enumerations'] = []): CanonicalUmlModel => ({ packages: [], classes, relationships, enumerations });
const successful = (value: ReturnType<typeof mapCanonicalUmlModel>) => {
  expect(value.success).toBe(true);
  if (!value.success) throw new Error(JSON.stringify(value.diagnostics));
  return value.model;
};

describe('RelationalMapper', () => {
  it('maps empty and simple models with a synthetic identity primary key', () => {
    expect(successful(mapCanonicalUmlModel(model([]))).tables).toEqual([]);
    const relational = successful(mapCanonicalUmlModel(model([clazz('person', 'Person')])));
    expect(relational.tables[0]).toMatchObject({ name: 'person', primaryKey: { columnIds: ['column:table:person:id'] } });
    expect(relational.tables[0].columns).toContainEqual(expect.objectContaining({ name: 'id', sqlType: 'BIGINT', javaType: 'Long', generated: true, nullable: false }));
  });

  it('maps all persistible primitive attributes and metadata constraints', () => {
    const relational = successful(mapCanonicalUmlModel(model([clazz('invoice', 'Invoice', [
      { id: 'text', name: 'title', visibility: 'private', type: primitive('string'), generation: { required: true, unique: true } },
      { id: 'amount', name: 'amount', visibility: 'private', type: primitive('number') },
      { id: 'flag', name: 'paid', visibility: 'private', type: primitive('boolean') },
      { id: 'day', name: 'issuedOn', visibility: 'private', type: primitive('date') },
      { id: 'time', name: 'createdAt', visibility: 'private', type: primitive('datetime') },
    ])])));
    const table = relational.tables[0];
    expect(table.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'title', sqlType: 'VARCHAR(255)', javaType: 'String', nullable: false }),
      expect.objectContaining({ name: 'amount', sqlType: 'NUMERIC', javaType: 'BigDecimal' }),
      expect.objectContaining({ name: 'paid', sqlType: 'BOOLEAN', javaType: 'Boolean' }),
      expect.objectContaining({ name: 'issued_on', sqlType: 'DATE', javaType: 'LocalDate' }),
      expect.objectContaining({ name: 'created_at', sqlType: 'TIMESTAMP WITH TIME ZONE', javaType: 'Instant' }),
    ]));
    expect(table.uniqueConstraints).toHaveLength(1);
  });

  it('uses only explicit identifier metadata and rejects invalid hints', () => {
    const customer = clazz('customer', 'Customer', [{ id: 'customer-number', name: 'customerNumber', visibility: 'private', type: primitive('number') }]);
    const explicit = successful(mapCanonicalUmlModel(model([customer]), { identifiers: [{ classId: 'customer', attributeId: 'customer-number' }] }));
    expect(explicit.tables[0].columns).toContainEqual(expect.objectContaining({ name: 'customer_number', sqlType: 'BIGINT', generated: false }));
    expect(explicit.tables[0].columns).not.toContainEqual(expect.objectContaining({ name: 'id', generated: true }));
    const normalId = successful(mapCanonicalUmlModel(model([clazz('normal', 'Normal', [{ id: 'attribute-id', name: 'id', visibility: 'private', type: primitive('string') }])])));
    expect(normalId.tables[0].primaryKey.columnIds).toEqual(['column:table:normal:id']);
    expect(normalId.tables[0].columns).toContainEqual(expect.objectContaining({ name: expect.stringMatching(/^id_/), sqlType: 'VARCHAR(255)' }));
    const invalid = mapCanonicalUmlModel(model([customer]), { identifiers: [{ classId: 'customer', attributeId: 'missing' }] });
    expect(invalid).toMatchObject({ success: false, diagnostics: [expect.objectContaining({ code: 'INVALID_IDENTIFIER_METADATA' })] });
    expect(mapCanonicalUmlModel(model([customer]), { identifiers: [{ classId: 'customer', attributeId: 'customer-number' }, { classId: 'customer', attributeId: 'customer-number' }] }).success).toBe(false);
    expect(mapCanonicalUmlModel(model([clazz('text-key', 'TextKey', [{ id: 'key', name: 'key', visibility: 'private', type: primitive('string') }])]), { identifiers: [{ classId: 'text-key', attributeId: 'key' }] }).success).toBe(false);
  });

  it('rejects void and custom/class scalar references', () => {
    const result = mapCanonicalUmlModel(model([clazz('bad', 'Bad', [
      { id: 'void', name: 'nothing', visibility: 'private', type: primitive('void') },
      { id: 'custom', name: 'opaque', visibility: 'private', type: { kind: 'custom', name: 'Money' } },
      { id: 'class', name: 'other', visibility: 'private', type: { kind: 'class', classId: 'missing' } },
    ])]));
    expect(result.success).toBe(false);
    expect(result.diagnostics.filter((item) => item.code === 'UNSUPPORTED_ATTRIBUTE_TYPE')).toHaveLength(3);
  });

  it('maps enums to VARCHAR CHECK constraints and rejects invalid enum literals', () => {
    const enums = [{ id: 'status', name: 'Status', literals: [{ id: 'open', name: 'OPEN' }, { id: 'closed', name: 'CLOSED' }] }];
    const relational = successful(mapCanonicalUmlModel(model([clazz('order', 'Order', [{ id: 'status-attr', name: 'status', visibility: 'private', type: { kind: 'enumeration', enumerationId: 'status' } }])], [], enums)));
    expect(relational.enums[0]).toMatchObject({ name: 'status', literals: ['CLOSED', 'OPEN'] });
    expect(relational.tables[0].checkConstraints[0].expression).toContain("'CLOSED'");
    expect(mapCanonicalUmlModel(model([], [], [{ id: 'bad', name: 'Bad', literals: [{ id: 'literal', name: 'not valid' }] }])).success).toBe(false);
  });

  it('maps 1:N, 1:1, N:M and relation indexes without redundant unique indexes', () => {
    const customer = clazz('customer', 'Customer'); const order = clazz('order', 'Order'); const profile = clazz('profile', 'Profile'); const tag = clazz('tag', 'Tag');
    const relational = successful(mapCanonicalUmlModel(model([customer, order, profile, tag], [
      relation('orders', 'association', 'customer', 1, 'order', '*'), relation('profile', 'association', 'customer', 1, 'profile', 1), relation('tags', 'association', 'order', '*', 'tag', '*'),
    ])));
    const orderTable = relational.tables.find((table) => table.id === 'table:order')!;
    const customerTable = relational.tables.find((table) => table.id === 'table:customer')!;
    expect(orderTable.foreignKeys).toHaveLength(1); expect(orderTable.indexes).toHaveLength(1);
    expect(customerTable.foreignKeys).toHaveLength(1); expect(customerTable.uniqueConstraints).toHaveLength(1); expect(customerTable.indexes).toHaveLength(0);
    const join = relational.tables.find((table) => table.kind === 'JOIN')!;
    expect(join.primaryKey.columnIds).toHaveLength(2); expect(join.foreignKeys).toHaveLength(2); expect(join.indexes).toHaveLength(1);
  });

  it('maps aggregation normally and composition with ownership cascade while rejecting ambiguous composition', () => {
    const team = clazz('team', 'Team'); const member = clazz('member', 'Member'); const order = clazz('order', 'Order'); const line = clazz('line', 'Line');
    const relational = successful(mapCanonicalUmlModel(model([team, member, order, line], [relation('members', 'aggregation', 'team', 1, 'member', '*'), relation('lines', 'composition', 'order', 1, 'line', '*')])));
    expect(relational.tables.find((table) => table.id === 'table:member')!.foreignKeys[0].onDelete).toBe('NO ACTION');
    expect(relational.tables.find((table) => table.id === 'table:line')!.foreignKeys[0].onDelete).toBe('CASCADE');
    const component = clazz('component', 'Component'); const zOwner = clazz('z-owner', 'ZOwner');
    const oneToOne = successful(mapCanonicalUmlModel(model([component, zOwner], [relation('part', 'composition', 'z-owner', 1, 'component', 1)])));
    expect(oneToOne.tables.find((table) => table.id === 'table:z-owner')!.foreignKeys[0].onDelete).toBe('CASCADE');
    expect(mapCanonicalUmlModel(model([order, line], [relation('invalid', 'composition', 'order', '*', 'line', '*')])).success).toBe(false);
  });

  it('maps JOINED inheritance, reuses the parent key, and rejects invalid hierarchies', () => {
    const person = clazz('person', 'Person'); const employee = clazz('employee', 'Employee'); const manager = clazz('manager', 'Manager');
    const generalization = (id: string, child: string, parent: string): UmlRelationship => ({ id, kind: 'generalization', source: { classId: child }, target: { classId: parent } });
    const relational = successful(mapCanonicalUmlModel(model([person, employee], [generalization('employee-person', 'employee', 'person')])));
    const parent = relational.tables.find((table) => table.id === 'table:person')!; const child = relational.tables.find((table) => table.id === 'table:employee')!;
    expect(child.primaryKey.columnIds).toHaveLength(1); expect(child.foreignKeys[0]).toMatchObject({ referencedTableId: parent.id });
    expect(mapCanonicalUmlModel(model([person, employee, manager], [generalization('a', 'employee', 'person'), generalization('b', 'employee', 'manager')])).success).toBe(false);
    expect(mapCanonicalUmlModel(model([person, employee], [generalization('a', 'employee', 'person'), generalization('b', 'person', 'employee')])).success).toBe(false);
  });

  it('handles deterministic SQL names, reserved words, caps, collisions, self relations and permutations', () => {
    const select = clazz('select', 'Select'); const long = clazz('long', 'A'.repeat(100)); const first = clazz('one', 'CustomerOrder'); const second = clazz('two', 'customer_order');
    const self = relation('self', 'association', 'one', '*', 'one', '*'); self.source.roleName = 'parents'; self.target.roleName = 'children';
    const input = model([select, long, first, second], [self]);
    const once = successful(mapCanonicalUmlModel(input)); const twice = successful(mapCanonicalUmlModel({ ...input, classes: [...input.classes].reverse(), relationships: [...input.relationships].reverse() }));
    expect(once).toEqual(twice);
    expect(once.tables.map((table) => table.name)).toContain('select_');
    expect(once.tables.every((table) => table.name.length <= 63)).toBe(true);
    expect(once.tables.filter((table) => table.kind === 'ENTITY' && table.name.startsWith('customer_order')).map((table) => table.name)).toHaveLength(2);
    expect(once.tables.some((table) => table.kind === 'JOIN')).toBe(true);
    expect(mapCanonicalUmlModel(model([first], [relation('bad-self', 'association', 'one', '*', 'one', '*')])).success).toBe(false);
  });

  it('returns deterministic diagnostics for malformed references and repeated input', () => {
    const bad = model([clazz('one', 'One')], [relation('bad', 'association', 'one', 1, 'missing', '*')]);
    const first = mapCanonicalUmlModel(bad); const second = mapCanonicalUmlModel(bad);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ success: false, diagnostics: [expect.objectContaining({ code: 'UNRESOLVED_REFERENCE' })] });
  });
});
