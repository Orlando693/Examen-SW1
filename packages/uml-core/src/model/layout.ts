import type { Uuid } from '../ids.js';

export interface DiagramPosition {
  x: number;
  y: number;
}

export interface DiagramSize {
  width: number;
  height: number;
}

export interface DiagramNodeLayout {
  id: Uuid;
  elementId: Uuid;
  position: DiagramPosition;
  size?: DiagramSize;
}

export interface DiagramLayout {
  nodes: DiagramNodeLayout[];
}

export function createEmptyDiagramLayout(): DiagramLayout {
  return { nodes: [] };
}
