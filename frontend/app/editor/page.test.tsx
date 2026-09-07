import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EditorPage, { metadata } from './page';

vi.mock('../../components/editor/UmlEditorClient', () => ({
  UmlEditorClient: () => <div data-testid="editor-client-boundary">Client boundary</div>,
}));

describe('EditorPage', () => {
  it('renders the localized client boundary from frontend/app/editor/page.tsx', () => {
    render(<EditorPage />);

    expect(screen.getByTestId('editor-client-boundary')).toBeInTheDocument();
    expect(metadata.title).toBe('Editor UML | Examen SW1 CASE');
  });
});
