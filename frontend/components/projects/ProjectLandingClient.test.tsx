import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectLandingClient } from './ProjectLandingClient';

const projectApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  updateMetadata: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../lib/projects/project-api', () => ({
  ProjectApiError: class ProjectApiError extends Error {},
  projectApi: projectApiMock,
}));

const project = {
  id: 'b7a8cbe3-21fb-4b7e-8adc-fca2f0d511c1',
  name: 'Orders',
  description: 'Order management',
  storageVersion: 4,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
};

describe('ProjectLandingClient', () => {
  beforeEach(() => {
    projectApiMock.list.mockReset();
    projectApiMock.create.mockReset();
    projectApiMock.updateMetadata.mockReset();
    projectApiMock.delete.mockReset();
  });

  it('renders loading, empty, and retryable list-error states', async () => {
    let resolveList: (value: typeof project[]) => void;
    projectApiMock.list.mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve; }));
    const { unmount } = render(<ProjectLandingClient />);
    expect(screen.getByLabelText('Loading projects')).toBeInTheDocument();
    resolveList!([]);
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    unmount();

    projectApiMock.list.mockRejectedValueOnce(new Error('Service unavailable'));
    projectApiMock.list.mockResolvedValueOnce([]);
    render(<ProjectLandingClient />);
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    const callsBeforeRetry = projectApiMock.list.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(projectApiMock.list).toHaveBeenCalledTimes(callsBeforeRetry + 1));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('submits creation from the landing', async () => {
    projectApiMock.list.mockResolvedValue([project]);
    projectApiMock.create.mockResolvedValue({ project: { id: project.id } });
    render(<ProjectLandingClient />);
    expect(await screen.findByText('Orders')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Project' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New UML' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(projectApiMock.create).toHaveBeenCalledWith({ name: 'New UML' }));
  });

  it('renames and deletes with the listed storage version', async () => {
    projectApiMock.list.mockResolvedValue([project]);
    projectApiMock.updateMetadata.mockResolvedValue({});
    projectApiMock.delete.mockResolvedValue(undefined);
    render(<ProjectLandingClient />);
    expect(await screen.findByText('Orders')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Orders v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(projectApiMock.updateMetadata).toHaveBeenCalledWith(project.id, { name: 'Orders v2', baseStorageVersion: 4 }));

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete “Orders”? This cannot be undone.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(projectApiMock.delete).toHaveBeenCalledWith(project.id, 4));
  });
});
