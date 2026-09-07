'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { UmlRelationshipEdgeData } from '../../../lib/editor/projection/project-document-to-flow';

const colors = {
  association: '#52677a',
  aggregation: '#164E72',
  composition: '#0B1F33',
  generalization: '#164E72',
};

export function UmlRelationshipEdge(props: EdgeProps) {
  const data = props.data as UmlRelationshipEdgeData | undefined;
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const kind = data?.kind ?? 'association';
  const marker = kind === 'generalization' ? '△' : kind === 'aggregation' ? '◇' : kind === 'composition' ? '◆' : '';

  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke: props.selected ? '#22A7B8' : colors[kind], strokeWidth: props.selected ? 3 : 2, filter: props.selected ? 'drop-shadow(0 0 3px rgba(34,167,184,0.45))' : undefined }} />
      <EdgeLabelRenderer>
        <div data-testid="uml-relationship-edge" style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, background: '#F8FAFB', border: `1px solid ${props.selected ? '#22A7B8' : '#C8D3DA'}`, borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#0B1F33', pointerEvents: 'all', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', boxShadow: props.selected ? '0 2px 8px rgba(34,167,184,0.20)' : 'none' }}>
          {marker} {data?.label ?? kind} {data?.sourceMultiplicity ?? ''} {data?.targetMultiplicity ? `-> ${data.targetMultiplicity}` : ''}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
