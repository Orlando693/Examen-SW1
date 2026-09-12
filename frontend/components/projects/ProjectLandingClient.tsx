'use client';

import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ProjectApiError, projectApi, type ProjectSummary } from '../../lib/projects/project-api';
import { InvitationPanel } from '../invitations/InvitationPanel';

export function ProjectLandingClient() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'create' | 'rename' | 'delete' | null>(null);
  const [selected, setSelected] = useState<ProjectSummary | null>(null);
  const [name, setName] = useState('');
  const requestId = useRef(0);

  async function load() {
    const id = ++requestId.current;
    setError(null);
    setProjects(null);
    try {
      const result = await projectApi.list();
      if (id === requestId.current) setProjects(result);
    } catch (cause) {
      if (cause instanceof ProjectApiError && cause.status === 401) {
        window.location.assign('/login?returnTo=%2F');
        return;
      }
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : 'Unable to load projects.');
    }
  }

  useEffect(() => { void load(); }, []);

  function openDialog(kind: 'create' | 'rename' | 'delete', project?: ProjectSummary) {
    setSelected(project ?? null);
    setName(project?.name ?? '');
    setDialog(kind);
  }

  async function submit() {
    if (dialog === 'delete' && selected) {
      await projectApi.delete(selected.id, selected.storageVersion);
    } else if (dialog === 'create') {
      const resource = await projectApi.create({ name });
      window.location.assign(`/editor?projectId=${encodeURIComponent(resource.project.id)}`);
      return;
    } else if (dialog === 'rename' && selected) {
      await projectApi.updateMetadata(selected.id, { name, baseStorageVersion: selected.storageVersion });
    }
    setDialog(null);
    await load();
  }

  return (
    <Box component="main" sx={{ height: '100dvh', overflowY: 'auto', py: { xs: 3, md: 7 }, bgcolor: '#F3F7F9' }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'end', justifyContent: 'space-between' }}>
            <Box><Typography component="h1" variant="h4" fontWeight={800}>Projects</Typography><Typography color="text.secondary">Persisted UML workspaces</Typography></Box>
            <Button variant="contained" onClick={() => openDialog('create')}>New Project</Button>
          </Box>
          {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
          {projects === null && !error && <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><CircularProgress aria-label="Loading projects" /></Box>}
          {projects?.length === 0 && <Paper sx={{ p: 5, textAlign: 'center' }}><Typography variant="h6">No projects yet</Typography><Typography color="text.secondary" sx={{ mb: 2 }}>Create a project to start modeling.</Typography><Button variant="contained" onClick={() => openDialog('create')}>New Project</Button></Paper>}
            {projects?.map((project) => <Paper key={project.id} sx={{ p: 2 }}><Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}><Box sx={{ minWidth: 0 }}><Typography fontWeight={700}>{project.name}</Typography><Typography variant="body2" color="text.secondary">{project.description ?? 'No description'} · {project.access === 'OWNER' ? 'Owner' : 'Editor'}</Typography></Box><Stack direction="row" spacing={1}><Button onClick={() => { window.location.assign(`/editor?projectId=${encodeURIComponent(project.id)}`); }}>Open</Button>{project.access === 'OWNER' && <><Button onClick={() => openDialog('rename', project)}>Rename</Button><Button color="error" onClick={() => openDialog('delete', project)}>Delete</Button></>}</Stack></Box>{project.access === 'OWNER' && <Box sx={{ mt: 2 }}><InvitationPanel projectId={project.id} /></Box>}</Paper>)}
        </Stack>
      </Container>
      <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="xs"><DialogTitle>{dialog === 'create' ? 'New Project' : dialog === 'rename' ? 'Rename Project' : 'Delete Project'}</DialogTitle><DialogContent>{dialog === 'delete' ? <Typography>Delete “{selected?.name}”? This cannot be undone.</Typography> : <TextField autoFocus margin="dense" label="Name" fullWidth value={name} onChange={(event) => setName(event.target.value)} />}</DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button color={dialog === 'delete' ? 'error' : 'primary'} variant="contained" disabled={dialog !== 'delete' && !name.trim()} onClick={() => void submit().catch((cause: unknown) => setError(cause instanceof ProjectApiError ? cause.message : 'Project operation failed.'))}>{dialog === 'delete' ? 'Delete' : 'Save'}</Button></DialogActions></Dialog>
    </Box>
  );
}
