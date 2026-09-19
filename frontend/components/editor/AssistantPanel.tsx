'use client';

import { Alert, Box, Button, CircularProgress, Divider, FormControlLabel, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { createAssistantModelContext, createPreview, type AssistantDiagnostic, type AssistantPreview } from '@examen-sw1/assistant-core';
import { ProjectApiError, projectApi } from '../../lib/projects/project-api';
import { useEditorStore } from '../../stores/editor-store';
import { VoiceRecorder } from '../../lib/voice/voice-recorder';

type PanelState = 'idle' | 'generating' | 'unavailable' | 'cancelled' | 'timeout' | 'invalid' | 'error';
type ClarificationCandidate = { id: string; name: string; kind: string };

function DiagnosticList({ diagnostics }: { diagnostics: AssistantDiagnostic[] }) {
  if (diagnostics.length === 0) return null;
  return <List dense aria-label="Assistant diagnostics">{diagnostics.map((item, index) => <ListItem key={`${item.code}-${index}`} disableGutters><ListItemText primary={item.code} secondary={item.message} /></ListItem>)}</List>;
}

export function AssistantPanel({ projectId }: { projectId: string | null }) {
  const document = useEditorStore((state) => state.currentDocument);
  const selection = useEditorStore((state) => state.selection);
  const applyAssistantPreview = useEditorStore((state) => state.applyAssistantPreview);
  const [text, setText] = useState('');
  const [state, setState] = useState<PanelState>(projectId ? 'idle' : 'unavailable');
  const [preview, setPreview] = useState<AssistantPreview | null>(null);
  const [diagnostics, setDiagnostics] = useState<AssistantDiagnostic[]>([]);
  const [presentation, setPresentation] = useState('');
  const [clarification, setClarification] = useState<ClarificationCandidate[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const recorder = useRef<VoiceRecorder | null>(null);
  const [voiceState, setVoiceState] = useState<'idle' | 'requesting' | 'recording' | 'processing' | 'unavailable' | 'error'>('idle');
  const [voiceDiagnostic, setVoiceDiagnostic] = useState('');

  const resetProposal = () => { setPreview(null); setClarification([]); setConfirmed(false); };
  const interpret = async () => {
    if (!projectId || !text.trim() || state === 'generating') return;
    const controller = new AbortController();
    request.current = controller;
    resetProposal();
    setDiagnostics([]);
    setPresentation('');
    setState('generating');
    try {
      const response = await projectApi.interpretAssistantStream(projectId, { text: text.trim() }, controller.signal, (chunk) => {
        if (request.current === controller) setPresentation((current) => current + chunk);
      });
      if (request.current !== controller) return;
      setDiagnostics(response.diagnostics);
      if (response.status !== 'success') { setState(response.status === 'model_unavailable' ? 'unavailable' : response.status); return; }
      if (response.clarification) { setClarification(response.clarification.candidates); setState('invalid'); return; }
      if (!response.candidate) { setState('invalid'); return; }
      const result = createPreview(text.trim(), response.candidate, createAssistantModelContext(document, selection?.id));
      if (!result.ok) {
        setClarification(result.clarification?.candidates ?? []);
        setDiagnostics((items) => [...items, ...result.diagnostics]);
        setState('invalid');
        return;
      }
      setPreview(result.preview);
      setState('idle');
    } catch (cause) {
      if (request.current !== controller) return;
      if (cause instanceof DOMException && cause.name === 'AbortError') { setState('cancelled'); return; }
      const error = cause as ProjectApiError;
      setDiagnostics([{ code: error.code ?? 'NETWORK_ERROR', message: error.message ?? 'Unable to interpret the request.', path: '$' }]);
      setState('error');
    } finally {
      if (request.current === controller) request.current = null;
    }
  };
  const cancelGeneration = () => { request.current?.abort(); request.current = null; resetProposal(); setPresentation(''); setState('cancelled'); };
  const cancelPreview = () => { resetProposal(); setState('idle'); };
  const record = async () => {
    try { setVoiceDiagnostic(''); setVoiceState('requesting'); const next = new VoiceRecorder(); recorder.current = next; await next.start(); setVoiceState('recording'); }
    catch (cause) { setVoiceState('error'); setVoiceDiagnostic(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'MICROPHONE_DENIED' : 'MICROPHONE_UNAVAILABLE'); }
  };
  const stopRecording = async () => {
    const active = recorder.current; if (!active) return; setVoiceState('processing'); const controller = new AbortController(); request.current = controller;
    try { const result = await projectApi.transcribeVoice(await active.stop(), controller.signal); if (request.current !== controller) return; if (result.status === 'final') { setText(result.text); setVoiceState('idle'); } else { setVoiceState(result.status === 'unavailable' ? 'unavailable' : 'error'); setVoiceDiagnostic(result.diagnostic.code); } }
    catch (cause) { if (cause instanceof DOMException && cause.name === 'AbortError') setVoiceState('idle'); else { setVoiceState('error'); setVoiceDiagnostic('TRANSCRIPTION_FAILED'); } }
    finally { if (request.current === controller) request.current = null; recorder.current = null; }
  };
  const cancelVoice = () => { recorder.current?.cancel(); recorder.current = null; request.current?.abort(); request.current = null; setVoiceState('idle'); };
  const apply = () => {
    if (!preview) return;
    const result = applyAssistantPreview(preview, confirmed);
    if (result.ok) { resetProposal(); setDiagnostics([]); setState('idle'); }
    else { setDiagnostics(result.diagnostics); setState('invalid'); }
  };

  return <Box component="section" aria-label="UML assistant" sx={{ p: 2, height: '100%', overflow: 'auto', bgcolor: '#F8FAFB' }}>
    <Stack spacing={1.5}>
      <Box><Typography variant="overline" color="text.secondary">LOCAL ASSISTANT</Typography><Typography variant="subtitle2">Propose a UML change for review</Typography></Box>
      {!projectId && <Alert severity="info">Open a persisted project to use the assistant.</Alert>}
      {state === 'unavailable' && <Alert severity="warning">The local model is unavailable. No change was proposed.</Alert>}
      {state === 'cancelled' && <Alert severity="info">Interpretation cancelled. The model was not applied.</Alert>}
      {state === 'timeout' && <Alert severity="warning">Interpretation timed out. Try a shorter request.</Alert>}
      {state === 'invalid' && <Alert severity="warning">No safe change is ready to apply.</Alert>}
       {state === 'error' && <Alert severity="error">The assistant request could not be completed.</Alert>}
       <TextField label="Describe a UML change" value={text} onChange={(event) => setText(event.target.value)} disabled={!projectId || state === 'generating'} multiline minRows={3} inputProps={{ maxLength: 2000 }} />
       {voiceState === 'recording' ? <Stack direction="row" spacing={1}><Button color="error" onClick={() => void stopRecording()}>Stop recording</Button><Button onClick={cancelVoice}>Cancel recording</Button></Stack> : voiceState === 'processing' ? <Button onClick={cancelVoice} startIcon={<CircularProgress size={14} />}>Cancel transcription</Button> : <Button variant="outlined" onClick={() => void record()} disabled={!projectId || state === 'generating'}>Record voice</Button>}
       {voiceState === 'unavailable' && <Alert severity="warning">The local speech model is unavailable.</Alert>}
       {voiceState === 'error' && <Alert severity="error">Voice transcription failed: {voiceDiagnostic}</Alert>}
       {state === 'generating' ? <Button variant="outlined" color="inherit" onClick={cancelGeneration} startIcon={<CircularProgress size={14} />}>Cancel interpretation</Button> : <Button variant="contained" onClick={() => void interpret()} disabled={!projectId || !text.trim()}>Generate preview</Button>}
       {presentation && <Typography aria-label="Assistant generation" variant="body2" color="text.secondary">{presentation}</Typography>}
      {clarification.length > 0 && <><Divider /><Typography variant="subtitle2">Choose a more specific target</Typography><List dense>{clarification.map((candidate) => <ListItem key={candidate.id} disableGutters><ListItemText primary={candidate.name} secondary={`${candidate.kind} · ${candidate.id}`} /></ListItem>)}</List></>}
      {preview && <><Divider /><Typography variant="subtitle2">Review proposal</Typography><Typography variant="body2">{preview.summary}</Typography><Typography variant="caption" color="text.secondary">{preview.umlCommands.length} UML command{preview.umlCommands.length === 1 ? '' : 's'} · revision {preview.contextRevision}</Typography>{preview.requiresConfirmation && <FormControlLabel control={<input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />} label="I confirm this destructive change." />}<Stack direction="row" spacing={1}><Button variant="contained" onClick={apply} disabled={preview.requiresConfirmation && !confirmed}>Apply</Button><Button onClick={cancelPreview}>Cancel preview</Button></Stack></>}
      <DiagnosticList diagnostics={diagnostics} />
    </Stack>
  </Box>;
}
