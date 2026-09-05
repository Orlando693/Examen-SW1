'use client';

import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

export type HealthState = 'loading' | 'available' | 'unavailable';

const DEFAULT_API_BASE_URL = 'http://localhost:3001';

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function HealthStatus({ initialState = 'loading' }: { initialState?: HealthState }) {
  const [state, setState] = useState<HealthState>(initialState);

  useEffect(() => {
    const controller = new AbortController();

    async function checkHealth() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/health`, {
          signal: controller.signal,
        });

        setState(response.ok ? 'available' : 'unavailable');
      } catch {
        if (!controller.signal.aborted) {
          setState('unavailable');
        }
      }
    }

    void checkHealth();

    return () => controller.abort();
  }, []);

  if (state === 'loading') {
    return (
      <Stack direction="row" spacing={2} alignItems="center" role="status">
        <CircularProgress size={22} />
        <Typography>Comprobando API...</Typography>
      </Stack>
    );
  }

  if (state === 'available') {
    return <Alert severity="success">API disponible</Alert>;
  }

  return <Alert severity="error">API no disponible</Alert>;
}
