import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthStatus } from './health-status';

describe('HealthStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows API available when the health request succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByText('API disponible')).toBeInTheDocument();
    });
  });

  it('shows API unavailable when the health request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByText('API no disponible')).toBeInTheDocument();
    });
  });
});
