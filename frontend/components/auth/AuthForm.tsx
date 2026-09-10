'use client';

import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { AuthApiError, authApi, safeReturnPath, setAuthSession } from '../../lib/auth/auth-session';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const title = mode === 'login' ? 'Sign in' : 'Create account';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = mode === 'login' ? await authApi.login({ email, password }) : await authApi.register({ email, password });
      setAuthSession(session);
      window.location.assign(safeReturnPath(searchParams.get('returnTo')));
    } catch (cause) {
      setError(cause instanceof AuthApiError ? cause.message : 'Unable to authenticate.');
    } finally {
      setSubmitting(false);
    }
  }

  return <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3, bgcolor: '#F3F7F9' }}><Container maxWidth="xs"><Paper component="form" onSubmit={submit} sx={{ p: 4 }}><Stack spacing={2.5}><Box><Typography component="h1" variant="h4" fontWeight={800}>{title}</Typography><Typography color="text.secondary">Use your email and password to continue.</Typography></Box>{error && <Alert severity="error">{error}</Alert>}<TextField required autoComplete="email" type="email" label="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><TextField required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" label="Password" helperText="8 to 128 characters" inputProps={{ minLength: 8, maxLength: 128 }} value={password} onChange={(event) => setPassword(event.target.value)} /><Button type="submit" variant="contained" disabled={submitting}>{submitting ? 'Please wait...' : title}</Button></Stack></Paper></Container></Box>;
}
