import { createProjectDocument, one, stringType, zeroToMany, type ProjectDocument } from '@examen-sw1/uml-core';

export function createDemoProjectDocument(): ProjectDocument {
  return createProjectDocument({
    id: 'demo-project-cu-02',
    name: 'Demo CU-02 UML Workspace',
    description: 'DEMO temporal en memoria hasta CU-03. Recargar la pagina puede reiniciar este documento.',
    now: '2026-09-05T00:00:00.000Z',
    model: {
      packages: [],
      classes: [
        {
          id: 'class-customer',
          name: 'Customer',
          generation: { entity: true, crud: true },
          attributes: [
            { id: 'attr-customer-name', name: 'name', visibility: 'private', type: stringType(), generation: { required: true } },
            { id: 'attr-customer-email', name: 'email', visibility: 'private', type: stringType(), generation: { unique: true } },
          ],
          operations: [{ id: 'op-customer-label', name: 'displayName', visibility: 'public', returnType: stringType(), parameters: [] }],
        },
        {
          id: 'class-order',
          name: 'Order',
          generation: { entity: true, crud: true },
          attributes: [{ id: 'attr-order-code', name: 'code', visibility: 'private', type: stringType() }],
          operations: [],
        },
        {
          id: 'class-priority-order',
          name: 'PriorityOrder',
          attributes: [],
          operations: [],
        },
        {
          id: 'class-invoice',
          name: 'invoice',
          attributes: [],
          operations: [],
        },
      ],
      enumerations: [
        {
          id: 'enum-order-status',
          name: 'OrderStatus',
          literals: [
            { id: 'literal-draft', name: 'DRAFT' },
            { id: 'literal-paid', name: 'PAID' },
          ],
        },
      ],
      relationships: [
        { id: 'rel-customer-orders', kind: 'composition', name: 'orders', source: { classId: 'class-customer', multiplicity: one }, target: { classId: 'class-order', multiplicity: zeroToMany } },
        { id: 'rel-priority-order', kind: 'generalization', source: { classId: 'class-priority-order' }, target: { classId: 'class-order' } },
        { id: 'rel-customer-invoice', kind: 'association', name: 'invoice', source: { classId: 'class-customer', multiplicity: one }, target: { classId: 'class-invoice', multiplicity: { lower: 0, upper: 1 } } },
      ],
    },
    layout: {
      nodes: [
        { id: 'node-customer', elementId: 'class-customer', position: { x: 80, y: 80 }, size: { width: 230, height: 180 } },
        { id: 'node-order', elementId: 'class-order', position: { x: 430, y: 90 }, size: { width: 220, height: 140 } },
        { id: 'node-priority-order', elementId: 'class-priority-order', position: { x: 430, y: 320 }, size: { width: 220, height: 110 } },
        { id: 'node-invoice', elementId: 'class-invoice', position: { x: 80, y: 330 }, size: { width: 220, height: 110 } },
        { id: 'node-status', elementId: 'enum-order-status', position: { x: 760, y: 100 }, size: { width: 210, height: 130 } },
      ],
    },
  });
}
