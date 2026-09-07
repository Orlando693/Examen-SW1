import ELK from 'elkjs/lib/elk.bundled.js';
import type { ApplyLayoutCommand, ProjectDocument } from '@examen-sw1/uml-core';
import { projectDocumentToFlow } from '../projection/project-document-to-flow';

interface ElkNodeResult {
  id: string;
  x?: number;
  y?: number;
}

interface ElkGraphResult {
  children?: ElkNodeResult[];
}

const elk = new ELK();

export async function createAutoLayoutCommand(document: ProjectDocument): Promise<ApplyLayoutCommand> {
  const flow = projectDocumentToFlow(document);
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
    },
    children: flow.nodes.map((node) => ({ id: node.id, width: 230, height: node.type === 'umlClass' ? 160 : 120 })),
    edges: flow.edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  };

  const result = (await elk.layout(graph)) as ElkGraphResult;
  return {
    type: 'ApplyLayout',
    updates: (result.children ?? []).map((node) => ({
      elementId: node.id,
      position: { x: Math.round(node.x ?? 0), y: Math.round(node.y ?? 0) },
    })),
  };
}
