import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock, documentsApi } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  documentsApi: {
    get: vi.fn(),
    versions: vi.fn(),
    update: vi.fn(),
    share: vi.fn(),
    revokeShare: vi.fn(),
    restoreVersion: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../app/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../services/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    error: string;

    constructor(status: number, error: string) {
      super(error);
      this.status = status;
      this.error = error;
    }
  },
  api: {
    documents: documentsApi,
  },
}));

vi.mock('../ai/useDocumentAi', () => ({
  useDocumentAi: () => ({
    prompt: '',
    setPrompt: vi.fn(),
    promptError: null,
    context: 'document',
    setContext: vi.fn(),
    suggestion: null,
    lastPrompt: null,
    isSuggesting: false,
    suggestError: null,
    submitSuggestion: vi.fn(),
    clearSuggestion: vi.fn(),
    history: [],
    historyError: null,
    isLoadingHistory: false,
    reloadHistory: vi.fn(),
  }),
}));

vi.mock('../ai/AIAssistantPanel', () => ({
  AIAssistantPanel: () => <div>Assistant mock</div>,
}));

vi.mock('./useCollaborationSession', () => ({
  useCollaborationSession: () => ({
    status: 'comingSoon',
    message: 'Collaboration not active yet.',
    expiresIn: 3600,
    retry: vi.fn(),
  }),
}));

vi.mock('./CollaborationReadinessPanel', () => ({
  CollaborationReadinessPanel: () => <div>Collaboration mock</div>,
}));

vi.mock('./useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: vi.fn(),
}));

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    editable,
    onChange,
    onBlur,
  }: {
    value: string;
    editable: boolean;
    onChange: (value: string) => void;
    onBlur?: () => void;
  }) => (
    <div>
      <div
        data-testid="rich-text-editor"
        contentEditable={editable}
        suppressContentEditableWarning
      >
        {value}
      </div>
      <button onClick={() => onChange('<p>Changed draft</p>')} type="button">
        Change draft
      </button>
      <button onClick={() => onBlur?.()} type="button">
        Blur editor
      </button>
    </div>
  ),
}));

import { EditorPage } from './EditorPage';

function renderEditorPage() {
  return render(
    <MemoryRouter initialEntries={['/documents/1']}>
      <Routes>
        <Route path="/documents/:id" element={<EditorPage />} />
        <Route path="/documents" element={<div>Documents route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      user: { id: 1, username: 'alice', email: 'alice@test.com' },
      signOut: vi.fn(),
    });

    documentsApi.get.mockResolvedValue({
      document: {
        id: 1,
        title: 'Project Plan',
        content: '<p>Initial draft</p>',
        owner_id: 1,
        created_at: '2026-04-17T10:00:00Z',
        updated_at: '2026-04-17T10:00:00Z',
      },
      collaborators: [],
    });
    documentsApi.versions.mockResolvedValue({ versions: [] });
    documentsApi.update.mockResolvedValue({
      document: {
        id: 1,
        title: 'Project Plan',
        content: '<p>Changed draft</p>',
        owner_id: 1,
        created_at: '2026-04-17T10:00:00Z',
        updated_at: '2026-04-17T10:01:00Z',
      },
    });
    documentsApi.share.mockResolvedValue({
      permission: {
        user: { id: 2, username: 'bob', email: 'bob@test.com' },
        role: 'viewer',
      },
    });
    documentsApi.restoreVersion.mockResolvedValue({
      document: {
        id: 1,
        title: 'Project Plan',
        content: '<p>Old snapshot</p>',
        owner_id: 1,
        created_at: '2026-04-17T10:00:00Z',
        updated_at: '2026-04-17T10:02:00Z',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the editor in read-only mode for viewers', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 2, username: 'bob', email: 'bob@test.com' },
      signOut: vi.fn(),
    });
    documentsApi.get.mockResolvedValue({
      document: {
        id: 1,
        title: 'Project Plan',
        content: '<p>Initial draft</p>',
        owner_id: 1,
        created_at: '2026-04-17T10:00:00Z',
        updated_at: '2026-04-17T10:00:00Z',
      },
      collaborators: [{ id: 2, username: 'bob', email: 'bob@test.com', role: 'viewer' }],
    });

    renderEditorPage();

    await screen.findByText('This document is open in view-only mode.');
    expect(screen.getByTestId('rich-text-editor')).toHaveAttribute('contenteditable', 'false');
  });

  it('autosaves rich-text edits after the debounce window', async () => {
    renderEditorPage();

    await screen.findByDisplayValue('Project Plan');
    vi.useFakeTimers();

    fireEvent.click(screen.getByText('Change draft'));

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(documentsApi.update).toHaveBeenCalledWith('1', {
      title: 'Project Plan',
      content: '<p>Changed draft</p>',
    });
  });

  it('shares by email or username from the access panel', async () => {
    renderEditorPage();

    await screen.findByDisplayValue('Project Plan');

    fireEvent.change(screen.getByLabelText('Invite by email or username'), {
      target: { value: 'bob' },
    });
    fireEvent.click(screen.getByText('Invite or update access'));

    await waitFor(() =>
      expect(documentsApi.share).toHaveBeenCalledWith('1', {
        identifier: 'bob',
        role: 'viewer',
      }),
    );
  });

  it('restores the selected version from history', async () => {
    documentsApi.versions.mockResolvedValue({
      versions: [
        {
          id: 9,
          document_id: 1,
          created_by: 1,
          created_at: '2026-04-17T09:00:00Z',
          created_by_username: 'alice',
          content: '<p>Old snapshot</p>',
        },
      ],
    });

    renderEditorPage();

    await screen.findByDisplayValue('Project Plan');
    fireEvent.click(screen.getByText('History'));
    await screen.findByText('Restore version');
    fireEvent.click(screen.getByText('Restore version'));

    await waitFor(() => expect(documentsApi.restoreVersion).toHaveBeenCalledWith('1', 9));
  });
});
