import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPanel } from './AssistantPanel';
import { resetEditorStoreForTests, useEditorStore } from '../../stores/editor-store';
import { createDemoProjectDocument } from '../../lib/editor/demo/demo-document';

const interpretAssistantStream = vi.hoisted(() => vi.fn());
const transcribeVoice = vi.hoisted(() => vi.fn());
const recorderStart = vi.hoisted(() => vi.fn());
const recorderStop = vi.hoisted(() => vi.fn());
const recorderCancel = vi.hoisted(() => vi.fn());
vi.mock('../../lib/projects/project-api', () => ({
  ProjectApiError: class ProjectApiError extends Error {},
  projectApi: { interpretAssistantStream, transcribeVoice },
}));
vi.mock('../../lib/voice/voice-recorder', () => ({
  VoiceRecorder: class VoiceRecorder {
    start = recorderStart;
    stop = recorderStop;
    cancel = recorderCancel;
  },
}));

describe('AssistantPanel', () => {
  beforeEach(() => {
    resetEditorStoreForTests(createDemoProjectDocument());
    interpretAssistantStream.mockReset();
    transcribeVoice.mockReset();
    recorderStart.mockReset();
    recorderStop.mockReset();
    recorderCancel.mockReset();
    recorderStart.mockResolvedValue(undefined);
    recorderStop.mockResolvedValue(new Blob(['voice'], { type: 'audio/wav' }));
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
  }, 15_000);

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

  it('sends only text while preserving the cancellation signal', async () => {
    interpretAssistantStream.mockResolvedValueOnce({ status: 'model_unavailable', diagnostics: [] });
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.change(screen.getByLabelText('Describe a UML change'), { target: { value: 'Create customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    await screen.findByText(/local model is unavailable/i);
    expect(interpretAssistantStream).toHaveBeenCalledWith('project-a', { text: 'Create customer' }, expect.any(AbortSignal), expect.any(Function));
    expect(interpretAssistantStream.mock.calls[0]?.[1]).not.toHaveProperty('timeoutMs');
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

  it('disables preview generation while transcribing and cancels only the voice request', async () => {
    let resolveTranscription!: (value: unknown) => void;
    transcribeVoice.mockImplementationOnce((_audio, signal) => new Promise((resolve) => { resolveTranscription = resolve; expect(signal).toBeInstanceOf(AbortSignal); }));
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }));
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(transcribeVoice).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Generate preview' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel transcription' }));
    expect(transcribeVoice.mock.calls[0]?.[1].aborted).toBe(true);
    resolveTranscription({ status: 'final', text: 'stale text' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel transcription' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Describe a UML change')).toHaveValue('');
    expect(interpretAssistantStream).not.toHaveBeenCalled();
  });

  it('keeps final transcription editable and submits it only after explicit preview generation', async () => {
    transcribeVoice.mockResolvedValueOnce({ status: 'final', text: 'crear clase Cliente' });
    interpretAssistantStream.mockResolvedValueOnce({ status: 'model_unavailable', diagnostics: [] });
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
    expect(await screen.findByDisplayValue('crear clase Cliente')).toBeInTheDocument();
    expect(interpretAssistantStream).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Describe a UML change'), { target: { value: 'crear clase Proveedor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    await screen.findByText(/local model is unavailable/i);
    expect(interpretAssistantStream).toHaveBeenCalledWith('project-a', { text: 'crear clase Proveedor' }, expect.any(AbortSignal), expect.any(Function));
  });

  it('does not publish a stale transcription after cancellation', async () => {
    let resolveTranscription!: (value: unknown) => void;
    transcribeVoice.mockImplementationOnce(() => new Promise((resolve) => { resolveTranscription = resolve; }));
    render(<AssistantPanel projectId="project-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(transcribeVoice).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel transcription' }));
    resolveTranscription({ status: 'final', text: 'do not publish' });
    await waitFor(() => expect(screen.getByLabelText('Describe a UML change')).toHaveValue(''));
  });

  it('aborts an in-flight transcription when the panel unmounts', async () => {
    transcribeVoice.mockImplementationOnce(() => new Promise(() => undefined));
    const view = render(<AssistantPanel projectId="project-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(transcribeVoice).toHaveBeenCalledTimes(1));
    const signal = transcribeVoice.mock.calls[0]?.[1] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(recorderCancel).toHaveBeenCalledTimes(1);
  });

  it('aborts an in-flight interpretation when the panel unmounts', async () => {
    interpretAssistantStream.mockImplementationOnce(() => new Promise(() => undefined));
    const view = render(<AssistantPanel projectId="project-a" />);
    fireEvent.change(screen.getByLabelText('Describe a UML change'), { target: { value: 'Create customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate preview' }));
    await waitFor(() => expect(interpretAssistantStream).toHaveBeenCalledTimes(1));
    const signal = interpretAssistantStream.mock.calls[0]?.[2] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
