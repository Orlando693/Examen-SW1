'use client';

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react';
import type { UmlRelationshipEdgeData } from '../../../lib/editor/projection/project-document-to-flow';

const colors = {
  association: '#52677a',
  aggregation: '#164E72',
  composition: '#0B1F33',
  generalization: '#164E72',
};

export function UmlRelationshipEdge(props: EdgeProps) {
  const data = props.data as UmlRelationshipEdgeData | undefined;
  const [sourcePosition, targetPosition] = relationshipSides(props.sourceX, props.sourceY, props.targetX, props.targetY);
  const [edgePath, labelX, labelY] = getSmoothStepPath({ ...props, sourcePosition, targetPosition, borderRadius: 12, offset: 24 });
  const kind = data?.kind ?? 'association';
  const color = props.selected ? '#22A7B8' : colors[kind];
  const markerId = `uml-relationship-${props.id}-${kind}`;
  const markerStart = kind === 'aggregation' || kind === 'composition' ? `url(#${markerId}-source)` : undefined;
  const markerEnd = kind === 'generalization' ? `url(#${markerId}-target)` : undefined;

  return (
    <>
      <defs>
        {(kind === 'aggregation' || kind === 'composition') && (
          <marker id={`${markerId}-source`} markerWidth="10" markerHeight="10" viewBox="0 0 10 10" refX="0" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0,5 L 5,0 L 10,5 L 5,10 Z" fill={kind === 'composition' ? color : '#F8FAFB'} stroke={color} strokeWidth="1.25" />
          </marker>
        )}
        {kind === 'generalization' && (
          <marker id={`${markerId}-target`} markerWidth="11" markerHeight="10" viewBox="0 0 11 10" refX="11" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0,0 L 11,5 L 0,10 Z" fill="#F8FAFB" stroke={color} strokeWidth="1.25" />
          </marker>
        )}
      </defs>
      <BaseEdge path={edgePath} markerStart={markerStart} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: props.selected ? 3 : 2, filter: props.selected ? 'drop-shadow(0 0 3px rgba(34,167,184,0.45))' : undefined }} />
      <EdgeLabelRenderer>
        {data?.label && <div data-testid="uml-relationship-name" style={labelStyle(labelX, labelY)}>{data.label}</div>}
        {data?.sourceMultiplicity && <div data-testid="uml-relationship-source-multiplicity" style={labelStyle(...endpointLabelPosition(props.sourceX, props.sourceY, props.targetX, props.targetY, 'source'))}>{data.sourceMultiplicity}</div>}
        {data?.targetMultiplicity && <div data-testid="uml-relationship-target-multiplicity" style={labelStyle(...endpointLabelPosition(props.sourceX, props.sourceY, props.targetX, props.targetY, 'target'))}>{data.targetMultiplicity}</div>}
      </EdgeLabelRenderer>
    </>
  );
}

export function relationshipSides(sourceX: number, sourceY: number, targetX: number, targetY: number): [Position, Position] {
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right];
  }
  return deltaY >= 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}

function labelStyle(x: number, y: number) {
  return {
    position: 'absolute' as const,
    transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
    background: '#F8FAFB',
    border: '1px solid #C8D3DA',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 11,
    color: '#0B1F33',
    pointerEvents: 'none' as const,
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  };
}

function endpointLabelPosition(sourceX: number, sourceY: number, targetX: number, targetY: number, endpoint: 'source' | 'target'): [number, number] {
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const length = Math.hypot(deltaX, deltaY);

  if (length === 0) {
    return [sourceX, sourceY];
  }

  const distance = Math.min(28, length * 0.22);
  const direction = endpoint === 'source' ? 1 : -1;
  const progress = endpoint === 'source' ? distance : length - distance;
  const offset = 10;
  const x = sourceX + (deltaX / length) * progress - (deltaY / length) * offset * direction;
  const y = sourceY + (deltaY / length) * progress + (deltaX / length) * offset * direction;

  return [roundCoordinate(x), roundCoordinate(y)];
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
