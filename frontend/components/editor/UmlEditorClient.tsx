'use client';

import '@xyflow/react/dist/style.css';

import { Alert, Box, Button, CircularProgress, Drawer, Stack, useMediaQuery, useTheme } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProjectApiError, projectApi } from '../../lib/projects/project-api';
import { getAuthSession } from '../../lib/auth/auth-session';
import { useEditorStore } from '../../stores/editor-store';
import { projectDocumentToFlow } from '../../lib/editor/projection/project-document-to-flow';
import { EditorAppBar } from './EditorAppBar';
import { EditorSidebar } from './EditorSidebar';
import { EditorToolbox } from './EditorToolbox';
import { UmlCanvas } from './UmlCanvas';
import { InspectorPanel } from './InspectorPanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { EditorStatusBar } from './EditorStatusBar';
import { CollaborationClient } from '../../lib/collaboration/collaboration-client';
import { CollaborationSessionBridge } from '../../lib/collaboration/collaboration-session-bridge';
import { RealtimeCommandGate } from '../../lib/collaboration/realtime-command-gate';
import { isProjectCommandApplied } from '../../lib/collaboration/project-command-applied';
import { isPresenceRoster, PresenceRoster } from '../../lib/collaboration/presence-roster';
import { LocalCursorPresence } from '../../lib/collaboration/local-cursor-presence';
import { LocalPresenceState } from '../../lib/collaboration/local-presence-state';
import { validEditingElementId } from '../../lib/collaboration/local-editing-presence';
import type { CollaborationConnectionState, CollaborationParticipant } from '../../lib/collaboration/contracts';

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
  const setRealtimeCommandGate = useEditorStore((state) => state.setRealtimeCommandGate);
  const setRealtimeCommandPending = useEditorStore((state) => state.setRealtimeCommandPending);
  const setRealtimeCommandError = useEditorStore((state) => state.setRealtimeCommandError);
  const rebaseHistoryToCurrentDocument = useEditorStore((state) => state.rebaseHistoryToCurrentDocument);
  const canvasRegionRef = useRef<HTMLDivElement | null>(null);
  const flow = useMemo(() => projectDocumentToFlow(currentDocument, selection, diagnostics), [currentDocument, selection, diagnostics]);
  const focusCanvas = () => window.requestAnimationFrame(() => canvasRegionRef.current?.focus());
  const [loading, setLoading] = useState(Boolean(selectedProjectId));
  const loadRequest = useRef(0);
  const collaboration = useRef<CollaborationClient | null>(null);
  const localCursor = useRef<LocalCursorPresence | null>(null);
  const localPresence = useRef<LocalPresenceState | null>(null);
  const [collaborationState, setCollaborationState] = useState<CollaborationConnectionState>('disconnected');
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const publishEditing = useCallback((elementId: string | null) => { const presenceState = localPresence.current; if (!presenceState) return; presenceState.setEditingElementId(validEditingElementId(elementId)); collaboration.current?.publishPresence(presenceState.snapshot()); }, []);
  const publishActivity = useCallback((activity: 'dragging' | null) => { const presenceState = localPresence.current; if (!presenceState) return; presenceState.setActivity(activity); collaboration.current?.publishPresence(presenceState.snapshot()); }, []);
  const publishSelection = useCallback((selectionIds: string[]) => { localPresence.current?.setSelectionIds(selectionIds); const presence = localPresence.current?.snapshot(); if (presence) collaboration.current?.publishPresence(presence); }, []);
  const publishCursor = useCallback((cursor: { x: number; y: number } | null) => localCursor.current?.publish(cursor), []);

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
    }).catch((cause: unknown) => {
      if (request !== loadRequest.current) return;
      if (cause instanceof ProjectApiError && cause.status === 401) {
        window.location.assign('/login?returnTo=%2Feditor');
      } else if (cause instanceof ProjectApiError && cause.code === 'PROJECT_NOT_FOUND') {
        window.location.assign('/');
      }
      // The store retains an already-open session if this request fails.
    }).finally(() => {
      if (request === loadRequest.current) setLoading(false);
    });
  }, [selectedProjectId, replaceProjectSession]);

  useEffect(() => {
    if (!selectedProjectId || sessionProjectId !== selectedProjectId) return;
    const session = getAuthSession();
    if (!session) { setParticipants([]); setCollaborationState('auth-required'); return; }
    const client = collaboration.current = new CollaborationClient();
    const roster = new PresenceRoster();
    const bridge = new CollaborationSessionBridge(client, useEditorStore.getState().installAuthoritativeDocument, (projectId, nextParticipants) => setParticipants(roster.replace(projectId, nextParticipants)));
    let commandGate: RealtimeCommandGate | null = null;
    let collaborationJoined = false;
    const exitCollaboration = () => {
      commandGate?.clear(); commandGate = null; setRealtimeCommandGate(null);
      localCursor.current?.dispose(); localCursor.current = null; localPresence.current = null;
      bridge.clear();
      if (collaborationJoined) { rebaseHistoryToCurrentDocument(); collaborationJoined = false; }
      roster.clear(); setParticipants([]);
    };
    const unsubscribeConnect = client.subscribe('connect', () => {
      setCollaborationState('joining');
      void bridge.join(selectedProjectId).then(({ ack, applied }) => { if (applied) { collaborationJoined = true; commandGate?.clear(); commandGate = new RealtimeCommandGate(() => bridge.session, client, setRealtimeCommandPending, setRealtimeCommandError, (result) => bridge.receiveApplied(result), undefined, async () => { setCollaborationState('resyncing'); const recovered = await bridge.recover(); if (recovered) setCollaborationState('connected'); return recovered; }); setRealtimeCommandGate(commandGate); localCursor.current?.dispose(); localPresence.current = new LocalPresenceState(); localCursor.current = new LocalCursorPresence((cursor) => { localPresence.current?.setCursor(cursor); const presence = localPresence.current?.snapshot(); if (presence) client.publishPresence(presence); }); setCollaborationState('connected'); } else if (!ack.ok) setCollaborationState(ack.action === 'REAUTHENTICATE' ? 'auth-required' : 'error'); });
    });
    const unsubscribeApplied = client.subscribe('project:command-applied', (value) => { if (isProjectCommandApplied(value)) bridge.receiveApplied(value); });
    const unsubscribePresence = client.subscribe('project:presence', (value) => { if (isPresenceRoster(value)) { const projectId = bridge.session?.projectId ?? selectedProjectId; if (bridge.receivePresence(projectId, value) === 'APPLIED') { const nextParticipants = roster.update(projectId, value); if (nextParticipants) setParticipants(nextParticipants); } } });
    const unsubscribeDisconnect = client.subscribe('disconnect', () => { exitCollaboration(); setCollaborationState('disconnected'); });
    const unsubscribeExpiry = client.subscribe('auth:expired', () => { exitCollaboration(); setCollaborationState('auth-required'); });
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') localCursor.current?.clear(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    client.connect(session.accessToken);
    return () => { document.removeEventListener('visibilitychange', onVisibilityChange); exitCollaboration(); unsubscribeConnect(); unsubscribePresence(); unsubscribeApplied(); unsubscribeDisconnect(); unsubscribeExpiry(); client.disconnect(); if (collaboration.current === client) collaboration.current = null; };
  }, [selectedProjectId, sessionProjectId, replaceProjectSession, rebaseHistoryToCurrentDocument, setRealtimeCommandError, setRealtimeCommandGate, setRealtimeCommandPending]);

  if (!selectedProjectId && !allowDemoForTests) {
    return <Box component="main" sx={{ height: '100dvh', display: 'grid', placeItems: 'center' }}><Stack spacing={2} alignItems="center"><Alert severity="info">Select a persisted project before opening the editor.</Alert><Button href="/">Go to projects</Button></Stack></Box>;
  }

  if (selectedProjectId && (loading || sessionProjectId !== selectedProjectId)) {
    return <Box component="main" sx={{ height: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Loading project" /></Box>;
  }

  return (
    <Box data-testid="editor-root" sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', width: '100vw', maxWidth: '100vw', height: '100dvh', minHeight: '100dvh', minWidth: 0, overflow: 'hidden', bgcolor: '#F3F7F9' }}>
       <EditorAppBar compact={compact} participants={participants} currentUserId={getAuthSession()?.user.id ?? null} />
       {operationalError && <Alert severity="error" sx={{ position: 'absolute', zIndex: 20, top: 52, right: 16 }}>{operationalError}</Alert>}
      <Box component="main" data-testid="uml-workspace" data-compact={compact ? 'true' : 'false'} sx={{ display: 'flex', height: '100%', minHeight: 0, minWidth: 0, width: '100%', overflow: 'hidden' }}>
        {!compact && <EditorSidebar compact={false} />}
        <Box ref={canvasRegionRef} tabIndex={-1} data-testid="editor-canvas-region" sx={{ flex: '1 1 0', alignSelf: 'stretch', height: '100%', minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden', outline: 0, bgcolor: '#F3F7F9', backgroundImage: 'linear-gradient(#D8E2E8 1px, transparent 1px), linear-gradient(90deg, #D8E2E8 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
          <EditorToolbox compact={compact} />
          <UmlCanvas flow={flow} compact={compact} canMount={isHydrated} participants={participants} currentUserId={getAuthSession()?.user.id ?? null} onLocalCursor={publishCursor} onLocalSelection={publishSelection} onLocalActivity={publishActivity} />
        </Box>
        {!compact && (
          <Box data-testid="editor-inspector-column" sx={{ width: 340, flex: '0 0 340px', minWidth: 300, maxWidth: 380, minHeight: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', borderLeft: 1, borderColor: '#C8D3DA', bgcolor: '#F8FAFB', overflow: 'hidden' }}>
             <InspectorPanel onEditingChange={publishEditing} />
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
                <InspectorPanel onEditingChange={publishEditing} />
                <DiagnosticsPanel />
              </Box>
            </Drawer>
          </>
        )}
      </Box>
      <EditorStatusBar compact={compact} collaborationState={collaborationState} />
    </Box>
  );
}
