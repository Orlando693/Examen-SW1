'use client';

import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, ViewportPortal, type Node, type OnSelectionChangeParams, type ReactFlowInstance } from '@xyflow/react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../stores/editor-store';
import type { ProjectDocumentFlow, UmlFlowEdge, UmlFlowNode } from '../../lib/editor/projection/project-document-to-flow';
import { UmlClassNode } from './nodes/UmlClassNode';
import { UmlEnumNode } from './nodes/UmlEnumNode';
import { UmlRelationshipEdge } from './edges/UmlRelationshipEdge';
import { RemoteCursorsOverlay } from './RemoteCursorsOverlay';
import { RemoteSelectionOverlay } from './RemoteSelectionOverlay';
import { RemoteEditingOverlay } from './RemoteEditingOverlay';
import type { CollaborationParticipant } from '../../lib/collaboration/contracts';
import type { FlowCursor } from '../../lib/collaboration/cursor-presence-publisher';
import { flowCursorFromPointer } from '../../lib/collaboration/local-cursor-presence';
import { presenceSelectionIds } from '../../lib/collaboration/local-selection-presence';

const nodeTypes = { umlClass: UmlClassNode, umlEnum: UmlEnumNode };
const edgeTypes = { umlRelationship: UmlRelationshipEdge };

export function UmlCanvas({ flow, compact = false, canMount = true, participants = [], currentUserId = null, onLocalCursor, onLocalSelection, onLocalActivity }: { flow: ProjectDocumentFlow; compact?: boolean; canMount?: boolean; participants?: CollaborationParticipant[]; currentUserId?: string | null; onLocalCursor?: (cursor: FlowCursor) => void; onLocalSelection?: (ids: string[]) => void; onLocalActivity?: (activity: 'dragging' | null) => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner flow={flow} compact={compact} canMount={canMount} participants={participants} currentUserId={currentUserId} onLocalCursor={onLocalCursor} onLocalSelection={onLocalSelection} onLocalActivity={onLocalActivity} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ flow, compact, canMount, participants, currentUserId, onLocalCursor, onLocalSelection, onLocalActivity }: { flow: ProjectDocumentFlow; compact: boolean; canMount: boolean; participants: CollaborationParticipant[]; currentUserId: string | null; onLocalCursor?: (cursor: FlowCursor) => void; onLocalSelection?: (ids: string[]) => void; onLocalActivity?: (activity: 'dragging' | null) => void }) {
  const setSelection = useEditorStore((state) => state.setSelection);
  const activeTool = useEditorStore((state) => state.activeTool);
  const startRelationship = useEditorStore((state) => state.startRelationship);
  const cancelRelationship = useEditorStore((state) => state.cancelRelationship);
  const completeRelationship = useEditorStore((state) => state.completeRelationship);
  const relationshipDraft = useEditorStore((state) => state.relationshipDraft);
  const moveNode = useEditorStore((state) => state.moveNode);
  const document = useEditorStore((state) => state.currentDocument);
  const projectId = useEditorStore((state) => state.projectId);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance<UmlFlowNode, UmlFlowEdge> | null>(null);
  const lastFitKeyRef = useRef('');
  const lastMeasuredSizeRef = useRef<{ width: number; height: number } | null>(null);
  const reactFlowReadyRef = useRef(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [isReactFlowReady, setIsReactFlowReady] = useState(false);
  const sourceClass = relationshipDraft?.sourceClassId ? document.model.classes.find((umlClass) => umlClass.id === relationshipDraft.sourceClassId) : undefined;
  const relationshipMode = activeTool !== 'select' && activeTool !== 'class' && activeTool !== 'enum';

  const onNodeDragStop = useCallback((_event: MouseEvent | TouchEvent, node: Node) => {
    onLocalActivity?.(null);
    const currentPosition = document.layout.nodes.find((layoutNode) => layoutNode.elementId === node.id)?.position;
    if (currentPosition?.x === node.position.x && currentPosition.y === node.position.y) {
      return;
    }
    moveNode(node.id, node.position);
  }, [document.layout.nodes, moveNode, onLocalActivity]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    onLocalSelection?.(presenceSelectionIds(params.nodes, params.edges));
    if (relationshipMode) {
      return;
    }
    const node = params.nodes[0];
    const edge = params.edges[0];
    if (node) {
      setSelection({ type: node.type === 'umlEnum' ? 'enumeration' : 'class', id: node.id });
      return;
    }
    if (edge) {
      setSelection({ type: 'relationship', id: edge.id });
      return;
    }
    setSelection(null);
  }, [onLocalSelection, relationshipMode, setSelection]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: { id: string; type?: string }) => {
    if (relationshipMode) {
      if (node.type === 'umlEnum') {
        return;
      }
      if (relationshipDraft?.sourceClassId) {
        completeRelationship(node.id);
      } else {
        startRelationship(activeTool, node.id);
      }
      return;
    }
    if (node.type === 'umlEnum') {
      setSelection({ type: 'enumeration', id: node.id });
      return;
    }
    setSelection({ type: 'class', id: node.id });
  }, [activeTool, completeRelationship, relationshipDraft?.sourceClassId, relationshipMode, setSelection, startRelationship]);

  const onEdgeClick = useCallback((_event: React.MouseEvent | MouseEvent, edge: { id: string }) => {
    setSelection({ type: 'relationship', id: edge.id });
  }, [setSelection]);

  const onInit = useCallback((instance: ReactFlowInstance<UmlFlowNode, UmlFlowEdge>) => {
    reactFlowRef.current = instance;
    if (!reactFlowReadyRef.current) {
      reactFlowReadyRef.current = true;
      setIsReactFlowReady(true);
    }
  }, []);

  useLayoutEffect(() => {
    if (!canMount) {
      return;
    }
    const element = canvasHostRef.current;
    if (!element) {
      return;
    }
    const host = element;
    function readSize() {
      const rect = host.getBoundingClientRect();
      const width = Math.round(host.clientWidth || host.offsetWidth || rect.width || 0);
      const height = Math.round(host.clientHeight || host.offsetHeight || rect.height || 0);
      return { width, height };
    }
    function updateSize(width: number, height: number) {
      const nextSize = { width, height };
      const previousSize = lastMeasuredSizeRef.current;
      if (previousSize?.width === width && previousSize.height === height) {
        return;
      }
      lastMeasuredSizeRef.current = nextSize;
      if (width > 0 && height > 0) {
        setContainerSize(nextSize);
        return;
      }
      reactFlowRef.current = null;
      if (reactFlowReadyRef.current) {
        reactFlowReadyRef.current = false;
        setIsReactFlowReady(false);
      }
      setContainerSize(null);
    }
    function measure() {
      const { width, height } = readSize();
      updateSize(width, height);
    }
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
    };
  }, [canMount]);

  useEffect(() => {
    if (!canMount || !containerSize || !isReactFlowReady || flow.nodes.length === 0) {
      return;
    }
    // Logical layout changes, including authoritative remote commands, must not recenter a user's viewport.
    const fitKey = `${projectId ?? 'unpersisted'}:${compact}:${containerSize.width}:${containerSize.height}`;
    if (lastFitKeyRef.current === fitKey) {
      return;
    }
    lastFitKeyRef.current = fitKey;
    const frame = window.requestAnimationFrame(() => {
      reactFlowRef.current?.fitView({ padding: compact ? 0.08 : 0.18, duration: 120, minZoom: compact ? 0.72 : 0.1 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [canMount, compact, containerSize, flow.nodes.length, isReactFlowReady, projectId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && relationshipMode) {
        cancelRelationship();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelRelationship, relationshipMode]);

  return (
    <Box data-testid="uml-canvas" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      {relationshipMode && (
        <Paper data-testid="relationship-feedback" elevation={0} sx={{ position: 'absolute', zIndex: 6, right: 12, top: 12, px: 1.25, py: 1, maxWidth: { xs: 'calc(100% - 24px)', sm: 380 }, border: '1px solid #22A7B8', borderLeft: '4px solid #22A7B8', bgcolor: '#F8FAFB', borderRadius: 1 }}>
          <Typography variant="body2" fontWeight={800} sx={{ color: '#0B1F33' }}>{sourceClass ? `Choose target: source ${sourceClass.name}` : 'Choose source'}</Typography>
          <Typography variant="caption" sx={{ color: '#647580', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}>RELATION / {activeTool}</Typography>
          <Button size="small" onClick={cancelRelationship} sx={{ ml: 1, textTransform: 'none' }}>Cancelar</Button>
        </Paper>
      )}
      <Box ref={canvasHostRef} data-testid="react-flow-host" onPointerMove={(event) => { const instance = reactFlowRef.current; if (instance && onLocalCursor) onLocalCursor(flowCursorFromPointer(event, (position) => instance.screenToFlowPosition(position))); }} onPointerLeave={() => onLocalCursor?.(null)} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {canMount && containerSize && (
          <ReactFlow<UmlFlowNode, UmlFlowEdge>
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={onInit}
            onNodeDragStop={onNodeDragStop}
            onNodeDragStart={() => onLocalActivity?.('dragging')}
            onSelectionChange={onSelectionChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            minZoom={compact ? 0.72 : 0.1}
            style={{ width: '100%', height: '100%' }}
          >
            <Background color="#D8E2E8" gap={28} />
            <ViewportPortal><RemoteCursorsOverlay participants={participants} currentUserId={currentUserId} /></ViewportPortal>
            <ViewportPortal><RemoteSelectionOverlay participants={participants} currentUserId={currentUserId} flow={flow} /></ViewportPortal>
            <ViewportPortal><RemoteEditingOverlay participants={participants} currentUserId={currentUserId} flow={flow} /></ViewportPortal>
            {!compact && <MiniMap pannable zoomable />}
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </Box>
    </Box>
  );
}
