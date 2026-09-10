import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EdgeProps } from '@xyflow/react';
import { relationshipSides, UmlRelationshipEdge } from './UmlRelationshipEdge';

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    BaseEdge: ({ markerStart, markerEnd }: { markerStart?: string; markerEnd?: string }) => <path data-testid="base-edge" markerStart={markerStart} markerEnd={markerEnd} />,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    getSmoothStepPath: () => ['M 0,0 L 100,100', 50, 50],
    Position: { Bottom: 'bottom', Left: 'left', Right: 'right', Top: 'top' },
  };
});

function renderEdge(kind: 'association' | 'aggregation' | 'composition' | 'generalization', data: Record<string, string | undefined> = {}) {
  render(<svg><UmlRelationshipEdge {...({ id: `relationship-${kind}`, source: 'source', target: 'target', sourceX: 10, sourceY: 20, targetX: 90, targetY: 100, data: { relationshipId: `relationship-${kind}`, kind, ...data } } as unknown as EdgeProps)} /></svg>);
}

describe('UmlRelationshipEdge', () => {
  it('uses canonical source/target orientation for UML markers', () => {
    renderEdge('aggregation');
    expect(screen.getByTestId('base-edge')).toHaveAttribute('marker-start', 'url(#uml-relationship-relationship-aggregation-aggregation-source)');
    expect(document.querySelector('marker')).toHaveAttribute('markerUnits', 'userSpaceOnUse');
    expect(document.querySelector('marker path')).toHaveAttribute('fill', '#F8FAFB');

    renderEdge('composition');
    expect(screen.getAllByTestId('base-edge')[1]).toHaveAttribute('marker-start', 'url(#uml-relationship-relationship-composition-composition-source)');
    expect(document.querySelectorAll('marker path')[1]).toHaveAttribute('fill', '#0B1F33');

    renderEdge('generalization');
    expect(screen.getAllByTestId('base-edge')[2]).toHaveAttribute('marker-end', 'url(#uml-relationship-relationship-generalization-generalization-target)');
    expect(document.querySelectorAll('marker path')[2]).toHaveAttribute('fill', '#F8FAFB');
  });

  it('renders only a true relationship name centrally and multiplicities interpolated beside endpoints', () => {
    renderEdge('association', { label: 'places', sourceMultiplicity: '1', targetMultiplicity: '0..*' });

    expect(screen.getByTestId('uml-relationship-name')).toHaveTextContent('places');
    expect(screen.getByTestId('uml-relationship-name')).toHaveStyle({ transform: 'translate(-50%, -50%) translate(50px,50px)' });
    expect(screen.getByTestId('uml-relationship-source-multiplicity')).toHaveTextContent('1');
    expect(screen.getByTestId('uml-relationship-source-multiplicity')).toHaveStyle({ transform: 'translate(-50%, -50%) translate(20.53px,44.67px)' });
    expect(screen.getByTestId('uml-relationship-target-multiplicity')).toHaveTextContent('0..*');
    expect(screen.getByTestId('uml-relationship-target-multiplicity')).toHaveStyle({ transform: 'translate(-50%, -50%) translate(79.47px,75.33px)' });
  });

  it('keeps endpoint multiplicities perpendicular to a vertical relationship', () => {
    render(<svg><UmlRelationshipEdge {...({ id: 'vertical', source: 'source', target: 'target', sourceX: 50, sourceY: 10, targetX: 50, targetY: 110, data: { relationshipId: 'vertical', kind: 'association', sourceMultiplicity: '1', targetMultiplicity: '*' } } as unknown as EdgeProps)} /></svg>);

    expect(screen.getByTestId('uml-relationship-source-multiplicity')).toHaveStyle({ transform: 'translate(-50%, -50%) translate(40px,32px)' });
    expect(screen.getByTestId('uml-relationship-target-multiplicity')).toHaveStyle({ transform: 'translate(-50%, -50%) translate(60px,88px)' });
  });

  it('does not render an automatic relationship-kind label', () => {
    renderEdge('association');

    expect(screen.queryByTestId('uml-relationship-name')).not.toBeInTheDocument();
    expect(screen.queryByText('association')).not.toBeInTheDocument();
  });

  it('selects orthogonal sides from the dominant direction between endpoints', () => {
    expect(relationshipSides(10, 10, 100, 30)).toEqual(['right', 'left']);
    expect(relationshipSides(100, 10, 10, 30)).toEqual(['left', 'right']);
    expect(relationshipSides(10, 10, 30, 100)).toEqual(['bottom', 'top']);
    expect(relationshipSides(10, 100, 30, 10)).toEqual(['top', 'bottom']);
  });
});
