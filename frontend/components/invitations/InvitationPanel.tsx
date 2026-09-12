'use client';

import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { InvitationApiError, invitationApi } from '../../lib/invitations/invitation-api';

export function InvitationPanel({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function create() {
    setError(null); setLink(null); setLoading(true);
    try { setLink((await invitationApi.create(projectId, email)).acceptanceUrl); setEmail(''); }
    catch (cause) { setError(cause instanceof InvitationApiError ? cause.message : 'Unable to create invitation.'); }
    finally { setLoading(false); }
  }
  return <Box><Typography variant="subtitle2" fontWeight={700}>Invite editor</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}><TextField label="Email" type="email" size="small" value={email} onChange={(event) => setEmail(event.target.value)} /><Button variant="outlined" disabled={loading || !email.trim()} onClick={() => void create()}>{loading ? 'Creating...' : 'Create invite'}</Button></Stack>{error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}{link && <Stack spacing={1} sx={{ mt: 1 }}><Typography variant="body2">Share this acceptance link once:</Typography><TextField aria-label="Invitation acceptance link" size="small" value={link} slotProps={{ input: { readOnly: true } }} /><Button size="small" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${link}`)}>Copy link</Button></Stack>}</Box>;
}
