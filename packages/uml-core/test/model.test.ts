import { describe, expect, it } from 'vitest';
import {
  createProjectDocument,
  deserializeProjectDocument,
  one,
  serializeProjectDocument,
  stringType,
  type DiagramLayout,
  type UmlClass,
  type UmlEnumeration,
  type UmlRelationship,
} from '../src/index.js';

describe('canonical UML model', () => {
  it('creates a valid ProjectDocument with model and layout separated', () => {
    const document = createProjectDocument({ id: 'project-1', name: 'Sample', ownerId: 'owner-1', now: '2026-09-04T00:00:00.000Z' });

    expect(document).toMatchObject({
      id: 'project-1',
      ownerId: 'owner-1',
      revision: 0,
      metadata: { name: 'Sample' },
      model: { packages: [], classes: [], enumerations: [], relationships: [] },
      layout: { nodes: [] },
    });
  });

  it('represents classes, attributes, operations, enums, relationships, multiplicities and layout without mixing coordinates into semantics', () => {
    const customer: UmlClass = {
      id: 'class-customer',
      name: 'Customer',
      attributes: [
        {
          id: 'attr-name',
          name: 'name',
          visibility: 'private',
          type: stringType(),
          generation: { required: true, searchable: true },
        },
      ],
      operations: [
        {
          id: 'op-display',
          name: 'displayName',
          visibility: 'public',
          returnType: stringType(),
          parameters: [],
        },
      ],
      generation: { entity: true, crud: true },
    };
    const order: UmlClass = { id: 'class-order', name: 'Order', attributes: [], operations: [] };
    const status: UmlEnumeration = {
      id: 'enum-status',
      name: 'OrderStatus',
      literals: [
        { id: 'literal-open', name: 'OPEN' },
        { id: 'literal-closed', name: 'CLOSED' },
      ],
    };
    const relationship: UmlRelationship = {
      id: 'rel-orders',
      kind: 'composition',
      name: 'orders',
      source: { classId: 'class-customer', multiplicity: one },
      target: { classId: 'class-order', multiplicity: { lower: 0, upper: '*' } },
    };
    const layout: DiagramLayout = {
      nodes: [
        { id: 'node-customer', elementId: 'class-customer', position: { x: 10, y: 20 }, size: { width: 200, height: 120 } },
      ],
    };
    const document = createProjectDocument({
      id: 'project-1',
      name: 'Shop',
      now: '2026-09-04T00:00:00.000Z',
      model: { packages: [{ id: 'pkg-sales', name: 'Sales' }], classes: [customer, order], enumerations: [status], relationships: [relationship] },
      layout,
    });

    expect(document.model.classes[0]).not.toHaveProperty('position');
    expect(document.layout.nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(document.model.enumerations[0].literals).toHaveLength(2);
    expect(document.model.relationships[0]).toMatchObject({ kind: 'composition', source: { classId: 'class-customer' } });
  });

  it('represents valid aggregation and generalization relationships with stable class references', () => {
    const document = createProjectDocument({
      id: 'project-1',
      name: 'Relationships',
      now: '2026-09-04T00:00:00.000Z',
      model: {
        packages: [],
        classes: [
          { id: 'class-team', name: 'Team', attributes: [], operations: [] },
          { id: 'class-member', name: 'Member', attributes: [], operations: [] },
          { id: 'class-admin', name: 'Admin', attributes: [], operations: [] },
        ],
        enumerations: [],
        relationships: [
          {
            id: 'rel-team-members',
            kind: 'aggregation',
            source: { classId: 'class-team', multiplicity: one },
            target: { classId: 'class-member', multiplicity: { lower: 0, upper: '*' } },
          },
          {
            id: 'rel-admin-member',
            kind: 'generalization',
            source: { classId: 'class-admin' },
            target: { classId: 'class-member' },
          },
        ],
      },
    });

    expect(document.model.relationships).toEqual([
      expect.objectContaining({ id: 'rel-team-members', kind: 'aggregation', source: { classId: 'class-team', multiplicity: one } }),
      expect.objectContaining({ id: 'rel-admin-member', kind: 'generalization', source: { classId: 'class-admin' }, target: { classId: 'class-member' } }),
    ]);
  });

  it('serializes and deserializes without losing semantic or layout information', () => {
    const document = createProjectDocument({
      id: 'project-1',
      name: 'Round Trip',
      now: '2026-09-04T00:00:00.000Z',
      model: {
        packages: [],
        classes: [{ id: 'class-1', name: 'Person', attributes: [{ id: 'attr-1', name: 'name', visibility: 'private', type: stringType() }], operations: [] }],
        enumerations: [],
        relationships: [],
      },
      layout: { nodes: [{ id: 'node-1', elementId: 'class-1', position: { x: 1, y: 2 } }] },
    });

    const roundTrip = deserializeProjectDocument(serializeProjectDocument(document));

    expect(roundTrip).toEqual(document);
  });
});
