import { describe, expect, it } from 'vitest';
import { createDemoProjectDocument } from '../demo/demo-document';
import { projectDocumentToFlow, relationshipToFlowEdge } from './project-document-to-flow';

describe('projectDocumentToFlow', () => {
  it('projects classes, enumerations and relationships from ProjectDocument', () => {
    const document = createDemoProjectDocument();
    const flow = projectDocumentToFlow(document);

    expect(flow.nodes.some((node) => node.id === 'class-customer' && node.type === 'umlClass')).toBe(true);
    expect(flow.nodes.some((node) => node.id === 'enum-order-status' && node.type === 'umlEnum')).toBe(true);
    expect(flow.edges).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'rel-customer-orders', type: 'umlRelationship', source: 'class-customer', target: 'class-order' })]));
  });

  it('uses DiagramLayout positions without treating React Flow as domain', () => {
    const document = createDemoProjectDocument();
    const node = projectDocumentToFlow(document).nodes.find((candidate) => candidate.id === 'class-customer');

    expect(node?.position).toEqual({ x: 80, y: 80 });
    expect(document.model.classes[0]).not.toHaveProperty('position');
  });

  it('does not mutate the source ProjectDocument while projecting', () => {
    const document = createDemoProjectDocument();
    const before = structuredClone(document);

    projectDocumentToFlow(document, { type: 'class', id: 'class-customer' });

    expect(document).toEqual(before);
  });

  it('projects only an explicit relationship name as the central edge label', () => {
    const document = createDemoProjectDocument();
    const named = document.model.relationships.find((relationship) => relationship.id === 'rel-customer-orders');
    const unnamed = { ...named!, id: 'rel-unnamed', name: undefined };

    expect(relationshipToFlowEdge(named!, null)).toMatchObject({ label: 'orders', data: { sourceMultiplicity: '1', targetMultiplicity: '0..*' } });
    expect(relationshipToFlowEdge(unnamed, null)).not.toHaveProperty('label');
  });

  it('does not project multiplicities for generalization', () => {
    const generalization = {
      id: 'rel-generalization',
      kind: 'generalization' as const,
      source: { classId: 'class-priority-order', multiplicity: { lower: 1, upper: 1 as const } },
      target: { classId: 'class-order', multiplicity: { lower: 0, upper: '*' as const } },
    };

    expect(relationshipToFlowEdge(generalization, null).data).not.toHaveProperty('sourceMultiplicity');
    expect(relationshipToFlowEdge(generalization, null).data).not.toHaveProperty('targetMultiplicity');
  });
});
