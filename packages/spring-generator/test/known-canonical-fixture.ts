import type { CanonicalUmlModel } from '@examen-sw1/uml-core';
import type { RelationalGenerationMetadata } from '@examen-sw1/relational-core';

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
const primitive = (name: 'string' | 'number' | 'boolean' | 'date' | 'datetime') => ({ kind: 'primitive' as const, name });
const attribute = (suffix: string, name: string, type: ReturnType<typeof primitive> | { kind: 'enumeration'; enumerationId: string }, generation?: { required?: boolean; unique?: boolean; searchable?: boolean; sortable?: boolean }) => ({ id: id(suffix), name, type, visibility: 'private' as const, generation });

export const knownCanonicalFixture: CanonicalUmlModel = {
  packages: [],
  enumerations: [{ id: id('1'), name: 'OrderStatus', literals: [{ id: id('2'), name: 'NEW' }, { id: id('3'), name: 'PAID' }] }],
  classes: [
    { id: id('10'), name: 'Customer', attributes: [attribute('11', 'customerNumber', primitive('number'), { required: true, unique: true }), attribute('12', 'name', primitive('string'), { required: true, searchable: true }), attribute('13', 'active', primitive('boolean')), attribute('14', 'birthDate', primitive('date')), attribute('15', 'createdAt', primitive('datetime'))], operations: [] },
    { id: id('20'), name: 'PreferredCustomer', attributes: [attribute('21', 'discountRate', primitive('number'))], operations: [] },
    { id: id('30'), name: 'Profile', attributes: [attribute('31', 'nickname', primitive('string'))], operations: [] },
    { id: id('40'), name: 'PurchaseOrder', attributes: [attribute('41', 'status', { kind: 'enumeration', enumerationId: id('1') }, { required: true })], operations: [] },
    { id: id('50'), name: 'OrderLine', attributes: [attribute('51', 'quantity', primitive('number'), { required: true })], operations: [] },
    { id: id('60'), name: 'Product', attributes: [attribute('61', 'sku', primitive('string'), { required: true, unique: true })], operations: [] },
  ],
  relationships: [
    { id: id('100'), kind: 'generalization', source: { classId: id('20') }, target: { classId: id('10') } },
    { id: id('101'), kind: 'association', name: 'customerProfile', source: { classId: id('10'), multiplicity: { lower: 0, upper: 1 } }, target: { classId: id('30'), multiplicity: { lower: 0, upper: 1 } } },
    { id: id('102'), kind: 'association', name: 'customerOrders', source: { classId: id('10'), multiplicity: { lower: 1, upper: 1 } }, target: { classId: id('40'), multiplicity: { lower: 0, upper: '*' } } },
    { id: id('103'), kind: 'composition', name: 'orderLines', source: { classId: id('40'), multiplicity: { lower: 1, upper: 1 } }, target: { classId: id('50'), multiplicity: { lower: 1, upper: '*' } } },
    { id: id('104'), kind: 'association', name: 'orderedProducts', source: { classId: id('40'), roleName: 'orders', multiplicity: { lower: 0, upper: '*' } }, target: { classId: id('60'), roleName: 'products', multiplicity: { lower: 0, upper: '*' } } },
    { id: id('105'), kind: 'aggregation', name: 'customerProducts', source: { classId: id('10'), multiplicity: { lower: 0, upper: 1 } }, target: { classId: id('60'), multiplicity: { lower: 0, upper: '*' } } },
  ],
};

export const knownFixtureMetadata: RelationalGenerationMetadata = { identifiers: [{ classId: id('10'), attributeId: id('11') }] };
