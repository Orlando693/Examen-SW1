import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPanel } from './AssistantPanel';
import { resetEditorStoreForTests, useEditorStore } from '../../stores/editor-store';
import { createDemoProjectDocument } from '../../lib/editor/demo/demo-document';

const interpretAssistantStream = vi.hoisted(() => vi.fn());
vi.mock('../../lib/projects/project-api', () => ({
  ProjectApiError: class ProjectApiError extends Error {},
  projectApi: { interpretAssistantStream },
}));

describe('AssistantPanel', () => {
  beforeEach(() => {
    resetEditorStoreForTests(createDemoProjectDocument());
    interpretAssistantStream.mockReset();
  });

  it('shows unavailable, timeout, invalid diagnostics, and clarification without mutating the model', async () => {
    const before = useEditorStore.getState().currentDocument;
    interpretAssistantStream.mockResolvedValueOnce({ status: 'model_unavailable', diagnostics: [] });
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.change(screen.getByLabelText('Describe a UML change'), { target: { value: 'Create customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    expect(await screen.findByText(/local model is unavailable/i)).toBeInTheDocument();

    interpretAssistantStream.mockResolvedValueOnce({ status: 'timeout', diagnostics: [{ code: 'GENERATION_TIMEOUT', message: 'Timed out', path: '$' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    expect(await screen.findByText('Interpretation timed out. Try a shorter request.')).toBeInTheDocument();

    interpretAssistantStream.mockResolvedValueOnce({ status: 'success', diagnostics: [{ code: 'AMBIGUOUS_REFERENCE', message: 'Choose Customer', path: '$' }], clarification: { version: 1, operation: 'needs_clarification', candidates: [{ id: 'class-customer', name: 'Customer', kind: 'class' }] } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    expect(await screen.findByText('Choose a more specific target')).toBeInTheDocument();
    expect(screen.getByText(/class-customer/)).toBeInTheDocument();
    expect(useEditorStore.getState().currentDocument).toBe(before);
  });

  it('cancels an in-flight interpretation and never exposes apply', async () => {
    let rejectRequest!: (reason: unknown) => void;
    interpretAssistantStream.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.change(screen.getByLabelText('Describe a UML change'), { target: { value: 'Create customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    expect(screen.getByRole('button', { name: 'Cancel interpretation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel interpretation' }));
    rejectRequest(new DOMException('Aborted', 'AbortError'));
    expect(await screen.findByText(/interpretation cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('requires review and destructive confirmation before applying a preview', async () => {
    interpretAssistantStream.mockResolvedValueOnce({ status: 'success', diagnostics: [], candidate: { version: 1, operation: 'delete_class', class: { id: 'class-invoice' } } });
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.change(screen.getByLabelText('Describe a UML change'), { target: { value: 'Delete invoice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    expect(await screen.findByText('Review proposal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(useEditorStore.getState().currentDocument.model.classes.some((item) => item.id === 'class-invoice')).toBe(true);
    fireEvent.click(screen.getByLabelText(/confirm this destructive/i));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(useEditorStore.getState().currentDocument.model.classes.some((item) => item.id === 'class-invoice')).toBe(false));
  });

  it('accumulates display-only chunks while generating and exposes a preview only after the final interpretation', async () => {
    let finish!: (value: unknown) => void;
    interpretAssistantStream.mockImplementationOnce((_id, _input, _signal, onChunk) => {
      onChunk('Interpreting request... ');
      onChunk('Validating UML context... ');
      return new Promise((resolve) => { finish = resolve; });
    });
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.change(screen.getByLabelText('Describe a UML change'), { target: { value: 'Create customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    expect(await screen.findByLabelText('Assistant generation')).toHaveTextContent('Interpreting request... Validating UML context...');
    expect(screen.getByRole('button', { name: 'Cancel interpretation' })).toBeInTheDocument();
    expect(screen.queryByText('Review proposal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    finish({ status: 'success', diagnostics: [], candidate: { version: 1, operation: 'create_class', name: 'Customer' } });
    expect(await screen.findByText('Review proposal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });
});
