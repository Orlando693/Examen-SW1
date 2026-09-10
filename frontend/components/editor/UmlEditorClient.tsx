'use client';

import '@xyflow/react/dist/style.css';

import { Alert, Box, Button, CircularProgress, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { projectApi } from '../../lib/projects/project-api';
import { useEditorStore } from '../../stores/editor-store';
import { projectDocumentToFlow } from '../../lib/editor/projection/project-document-to-flow';
import { EditorAppBar } from './EditorAppBar';
import { EditorSidebar } from './EditorSidebar';
import { EditorToolbox } from './EditorToolbox';
import { UmlCanvas } from './UmlCanvas';
import { InspectorPanel } from './InspectorPanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { EditorStatusBar } from './EditorStatusBar';

export function UmlEditorClient({ projectId, allowDemoForTests = process.env.NODE_ENV === 'test' }: { projectId?: string; allowDemoForTests?: boolean }) {
  const searchParams = useSearchParams();
  const selectedProjectId = projectId ?? searchParams?.get('projectId') ?? undefined;
  const theme = useTheme();
  const mediaCompact = useMediaQuery(theme.breakpoints.down('md'));
  const [isHydrated, setIsHydrated] = useState(false);
  const compact = isHydrated ? mediaCompact : false;
  const currentDocument = useEditorStore((state) => state.currentDocument);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const selection = useEditorStore((state) => state.selection);
  const isSidebarOpen = useEditorStore((state) => state.isSidebarOpen);
  const isInspectorOpen = useEditorStore((state) => state.isInspectorOpen);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const toggleInspector = useEditorStore((state) => state.toggleInspector);
  const replaceProjectSession = useEditorStore((state) => state.replaceProjectSession);
  const sessionProjectId = useEditorStore((state) => state.projectId);
  const operationalError = useEditorStore((state) => state.operationalError);
  const canvasRegionRef = useRef<HTMLDivElement | null>(null);
  const flow = useMemo(() => projectDocumentToFlow(currentDocument, selection, diagnostics), [currentDocument, selection, diagnostics]);
  const focusCanvas = () => window.requestAnimationFrame(() => canvasRegionRef.current?.focus());
  const [loading, setLoading] = useState(Boolean(selectedProjectId));
  const loadRequest = useRef(0);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }
    const request = ++loadRequest.current;
    setLoading(true);
    void projectApi.get(selectedProjectId).then((resource) => {
      if (request === loadRequest.current) replaceProjectSession(resource);
    }).catch(() => {
      // The store retains an already-open session if this request fails.
    }).finally(() => {
      if (request === loadRequest.current) setLoading(false);
    });
  }, [selectedProjectId, replaceProjectSession]);

  if (!selectedProjectId && !allowDemoForTests) {
    return <Box component="main" sx={{ height: '100dvh', display: 'grid', placeItems: 'center' }}><Stack spacing={2} alignItems="center"><Alert severity="info">Select a persisted project before opening the editor.</Alert><Button href="/">Go to projects</Button></Stack></Box>;
  }

  if (selectedProjectId && (loading || sessionProjectId !== selectedProjectId)) {
    return <Box component="main" sx={{ height: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Loading project" /></Box>;
  }

  return (
    <Box data-testid="editor-root" sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', width: '100vw', maxWidth: '100vw', height: '100dvh', minHeight: '100dvh', minWidth: 0, overflow: 'hidden', bgcolor: '#F3F7F9' }}>
       <EditorAppBar compact={compact} />
       {operationalError && <Alert severity="error" sx={{ position: 'absolute', zIndex: 20, top: 52, right: 16 }}>{operationalError}</Alert>}
      <Box component="main" data-testid="uml-workspace" data-compact={compact ? 'true' : 'false'} sx={{ display: 'flex', height: '100%', minHeight: 0, minWidth: 0, width: '100%', overflow: 'hidden' }}>
        {!compact && <EditorSidebar compact={false} />}
        <Box ref={canvasRegionRef} tabIndex={-1} data-testid="editor-canvas-region" sx={{ flex: '1 1 0', alignSelf: 'stretch', height: '100%', minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden', outline: 0, bgcolor: '#F3F7F9', backgroundImage: 'linear-gradient(#D8E2E8 1px, transparent 1px), linear-gradient(90deg, #D8E2E8 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
          <EditorToolbox compact={compact} />
          <UmlCanvas flow={flow} compact={compact} canMount={isHydrated} />
        </Box>
        {!compact && (
          <Box data-testid="editor-inspector-column" sx={{ width: 340, flex: '0 0 340px', minWidth: 300, maxWidth: 380, minHeight: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', borderLeft: 1, borderColor: '#C8D3DA', bgcolor: '#F8FAFB', overflow: 'hidden' }}>
            <InspectorPanel />
            <DiagnosticsPanel />
          </Box>
        )}
        {compact && (
          <>
            <Drawer open={isSidebarOpen} onClose={() => { toggleSidebar(); focusCanvas(); }} ModalProps={{ keepMounted: true }} PaperProps={{ sx: { width: 'min(90vw, 320px)', maxWidth: '90vw' } }}>
              <EditorSidebar compact />
            </Drawer>
            <Drawer anchor="right" open={isInspectorOpen} onClose={() => { toggleInspector(); focusCanvas(); }} ModalProps={{ keepMounted: true }} PaperProps={{ sx: { width: 'min(92vw, 420px)', maxWidth: '92vw' } }}>
              <Box sx={{ width: '100%', height: '100%', minHeight: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', overflow: 'hidden' }}>
                <InspectorPanel />
                <DiagnosticsPanel />
              </Box>
            </Drawer>
          </>
        )}
      </Box>
      <EditorStatusBar compact={compact} />
    </Box>
  );
}
