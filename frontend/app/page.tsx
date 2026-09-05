import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import { HealthState, HealthStatus } from '../components/health-status';

export const dynamic = 'force-dynamic';

const DEFAULT_API_BASE_URL = 'http://localhost:3001';

async function getInitialHealthState(): Promise<HealthState> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

  try {
    const response = await fetch(`${apiBaseUrl}/health`, { cache: 'no-store' });
    return response.ok ? 'available' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export default async function Home() {
  const initialHealthState = await getInitialHealthState();

  return (
    <Box component="main" sx={{ minHeight: '100vh', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Paper elevation={2} sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography component="h1" variant="h4" fontWeight={700} gutterBottom>
                Examen SW1 CASE
              </Typography>
              <Typography color="text.secondary">
                Base ejecutable del monorepo con comunicacion minima frontend a backend.
              </Typography>
            </Box>
            <HealthStatus initialState={initialHealthState} />
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
