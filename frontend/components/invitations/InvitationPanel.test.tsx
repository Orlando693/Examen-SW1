import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationPanel } from './InvitationPanel';

const create = vi.hoisted(() => vi.fn());
vi.mock('../../lib/invitations/invitation-api', () => ({ InvitationApiError: class InvitationApiError extends Error {}, invitationApi: { create } }));

describe('InvitationPanel', () => {
  beforeEach(() => create.mockReset());
  it('creates and displays the one-time fragment link without retaining a token input', async () => {
    create.mockResolvedValue({ invitation: {}, acceptanceUrl: '/invitations/accept#token=secret' });
    render(<InvitationPanel projectId="b7a8cbe3-21fb-4b7e-8adc-fca2f0d511c1" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'editor@example.com' } }); fireEvent.click(screen.getByRole('button', { name: 'Create invite' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith('b7a8cbe3-21fb-4b7e-8adc-fca2f0d511c1', 'editor@example.com'));
    expect(screen.getByDisplayValue('/invitations/accept#token=secret')).toBeInTheDocument();
  });
});
