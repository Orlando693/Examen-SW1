'use client';

import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { authApi } from '../../lib/auth/auth-session';
import { InvitationApiError, invitationApi } from '../../lib/invitations/invitation-api';
import { clearInvitationToken, getInvitationToken, setInvitationToken } from '../../lib/invitations/invitation-continuation';

const terminal = new Set(['INVITATION_EXPIRED', 'INVITATION_REVOKED', 'INVITATION_ALREADY_CONSUMED', 'INVITATION_INVALID']);

export function InvitationAcceptClient() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (token) { setInvitationToken(token); window.history.replaceState(null, '', window.location.pathname); }
    void authApi.restore().then((session) => { if (!session) window.location.assign('/login?returnTo=%2Finvitations%2Faccept'); else setReady(true); });
  }, []);
  async function act(action: 'accept' | 'reject') {
    const token = getInvitationToken(); if (!token) { setMessage('This invitation link is missing its token.'); return; }
    setActioning(true);
    try { await invitationApi[action](token); clearInvitationToken(); window.location.assign('/'); }
    catch (cause) { const error = cause instanceof InvitationApiError ? cause : new InvitationApiError('HTTP_ERROR', 'Unable to process invitation.'); setMessage(error.message); if (terminal.has(error.code)) clearInvitationToken(); }
    finally { setActioning(false); }
  }
  useEffect(() => { if (!ready) return; const token = getInvitationToken(); if (!token) { setMessage('This invitation link is missing its token.'); return; } void invitationApi.inspect(token).catch((cause: unknown) => { const error = cause instanceof InvitationApiError ? cause : new InvitationApiError('HTTP_ERROR', 'Unable to inspect invitation.'); setMessage(error.message); if (terminal.has(error.code)) clearInvitationToken(); }); }, [ready]);
  if (!ready) return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Loading invitation" /></Box>;
  return <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3, bgcolor: '#F3F7F9' }}><Container maxWidth="xs"><Paper sx={{ p: 4 }}><Stack spacing={2}><Typography component="h1" variant="h4" fontWeight={800}>Project invitation</Typography>{message ? <Alert severity="error">{message}</Alert> : <Typography>Accept this invitation to become an editor.</Typography>}<Stack direction="row" spacing={1}><Button variant="contained" disabled={actioning || Boolean(message)} onClick={() => void act('accept')}>Accept</Button><Button disabled={actioning || Boolean(message)} onClick={() => void act('reject')}>Reject</Button><Button onClick={() => { clearInvitationToken(); window.location.assign('/'); }}>Cancel</Button></Stack></Stack></Paper></Container></Box>;
}
