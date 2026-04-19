import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useAuthMock,
  documentsApi,
  shareLinksApi,
  persistSnapshotMock,
  applyServerDocumentMock,
  replaceWithSuggestionMock,
  replaceSelectionWithSuggestionMock,
  appendSuggestionMock,
  undoLastAiApplyMock,
  clearTransientSaveStateMock,
} = vi.hoisted(() => ({
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
  shareLinksApi: {
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    accept: vi.fn(),
  },
  persistSnapshotMock: vi.fn(),
  applyServerDocumentMock: vi.fn(),
  replaceWithSuggestionMock: vi.fn(),
  replaceSelectionWithSuggestionMock: vi.fn(),
  appendSuggestionMock: vi.fn(),
  undoLastAiApplyMock: vi.fn(),
  clearTransientSaveStateMock: vi.fn(),
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
    shareLinks: shareLinksApi,
  },
}));

vi.mock('../ai/useDocumentAi', () => ({
  useDocumentAi: () => ({
    feature: 'rewrite',
    setFeature: vi.fn(),
    prompt: '',
    setPrompt: vi.fn(),
    promptError: null,
    context: 'section',
    setContext: vi.fn(),
    tone: 'professional',
    setTone: vi.fn(),
    summaryLength: 'short',
    setSummaryLength: vi.fn(),
    summaryFormat: 'paragraph',
    setSummaryFormat: vi.fn(),
    suggestion: '',
    setSuggestion: vi.fn(),
    suggestionSourceText: 'Selected source text',
    lastPrompt: null,
    lastModel: 'draftboard-stub-v1',
    activeInteractionId: 1,
    isSuggestionEdited: false,
    hasSelectionContext: true,
    isSuggesting: false,
    suggestError: null,
    submitSuggestion: vi.fn(),
    cancelSuggestion: vi.fn(),
    clearSuggestion: vi.fn(),
    recordDecision: vi.fn(),
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
    status: 'ready',
    message: 'Collaboration connected.',
    session: {
      session_token: 'collab-token',
      ws_url: 'ws://localhost:3001/ws/collab',
      expires_in: 1800,
      role: 'owner',
    },
    retry: vi.fn(),
  }),
}));

vi.mock('./useCollaborativeEditor', () => ({
  useCollaborativeEditor: () => ({
    editor: { isActive: vi.fn(() => false), chain: vi.fn(() => ({ focus: () => ({ setParagraph: () => ({ run: vi.fn() }), toggleHeading: () => ({ run: vi.fn() }), toggleBold: () => ({ run: vi.fn() }), toggleItalic: () => ({ run: vi.fn() }), toggleBulletList: () => ({ run: vi.fn() }), toggleOrderedList: () => ({ run: vi.fn() }), toggleCodeBlock: () => ({ run: vi.fn() }) }) })) },
    connectionState: 'connected',
    connectionMessage: 'Live collaboration is active.',
    presenceUsers: [
      {
        clientId: 1,
        userId: 1,
        name: 'alice',
        color: '#115e59',
        role: 'owner',
        activity: 'typing',
        lastActiveAt: new Date().toISOString(),
        active: true,
        connections: 1,
      },
    ],
    saveState: 'queued',
    saveError: null,
    saveMessage: 'Working offline. Changes are stored locally and will sync when the connection returns.',
    isDirty: true,
    plainText: 'Draft text',
    selectionText: 'Draft text',
    canUndoAiApply: false,
    persistSnapshot: persistSnapshotMock,
    applyServerDocument: applyServerDocumentMock,
    replaceWithSuggestion: replaceWithSuggestionMock,
    replaceSelectionWithSuggestion: replaceSelectionWithSuggestionMock,
    appendSuggestion: appendSuggestionMock,
    undoLastAiApply: undoLastAiApplyMock,
    clearTransientSaveState: clearTransientSaveStateMock,
  }),
}));

vi.mock('./useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: vi.fn(),
}));

vi.mock('./CollaborativeEditorAdapter', () => ({
  CollaborativeEditorAdapter: ({
    readOnly,
  }: {
    readOnly: boolean;
  }) => <div data-testid="collaborative-editor">{readOnly ? 'read-only' : 'editable'}</div>,
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
    });

    documentsApi.get.mockResolvedValue({
      document: {
        id: 1,
        title: 'Project Plan',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        owner_id: 1,
        created_at: '2026-04-17T10:00:00Z',
        updated_at: '2026-04-17T10:00:00Z',
      },
      collaborators: [],
    });
    documentsApi.versions.mockResolvedValue({
      versions: [
        {
          id: 9,
          document_id: 1,
          created_by: 1,
          created_at: '2026-04-17T09:00:00Z',
          created_by_username: 'alice',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old snapshot' }] }] },
        },
      ],
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
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old snapshot' }] }] },
        owner_id: 1,
        created_at: '2026-04-17T10:00:00Z',
        updated_at: '2026-04-17T10:02:00Z',
      },
    });
    shareLinksApi.list.mockResolvedValue({
      share_links: [
        {
          id: 5,
          role: 'viewer',
          token: 'viewer-token',
          url: 'http://localhost:5173/share/viewer-token',
          created_at: '2026-04-17T10:00:00Z',
          revoked_at: null,
        },
      ],
    });
    shareLinksApi.create.mockResolvedValue({
      share_link: {
        id: 6,
        role: 'editor',
        token: 'editor-token',
        url: 'http://localhost:5173/share/editor-token',
        created_at: '2026-04-17T10:05:00Z',
        revoked_at: null,
      },
    });
    shareLinksApi.revoke.mockResolvedValue({ message: 'Share link revoked' });
  });

  it('renders autosave and collaboration status for owners', async () => {
    renderEditorPage();

    await screen.findByDisplayValue('Project Plan');
    expect(screen.getByText('Autosave is on')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Collab'));
    expect(screen.getByText('Typing')).toBeInTheDocument();
    expect(screen.getByTestId('collaborative-editor')).toHaveTextContent('editable');
  });

  it('renders the editor in read-only mode for viewers', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 2, username: 'bob', email: 'bob@test.com' },
    });
    documentsApi.get.mockResolvedValue({
      document: {
        id: 1,
        title: 'Project Plan',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        owner_id: 1,
        created_at: '2026-04-17T10:00:00Z',
        updated_at: '2026-04-17T10:00:00Z',
      },
      collaborators: [{ id: 2, username: 'bob', email: 'bob@test.com', role: 'viewer' }],
    });

    renderEditorPage();

    await screen.findByText('This document is read-only for your current access level.');
    expect(screen.getByTestId('collaborative-editor')).toHaveTextContent('read-only');
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

  it('creates and revokes share links from the access panel', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    renderEditorPage();

    await screen.findByDisplayValue('Project Plan');
    fireEvent.change(screen.getByLabelText('Link role'), {
      target: { value: 'editor' },
    });
    fireEvent.click(screen.getByText('Create link'));

    await waitFor(() =>
      expect(shareLinksApi.create).toHaveBeenCalledWith('1', { role: 'editor' }),
    );

    fireEvent.click(screen.getAllByText('Revoke')[0]);

    await waitFor(() => expect(shareLinksApi.revoke).toHaveBeenCalledWith('1', 6));
  });

  it('restores the selected version from history', async () => {
    renderEditorPage();

    await screen.findByDisplayValue('Project Plan');
    fireEvent.click(screen.getByText('History'));
    await screen.findByText('Restore version');
    fireEvent.click(screen.getByText('Restore version'));

    await waitFor(() => expect(documentsApi.restoreVersion).toHaveBeenCalledWith('1', 9));
    await waitFor(() =>
      expect(applyServerDocumentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: 'Project Plan',
        }),
      ),
    );
  });

  it('allows an immediate save from the toolbar action', async () => {
    renderEditorPage();

    await screen.findByDisplayValue('Project Plan');
    fireEvent.click(screen.getByText('Save now'));

    await waitFor(() => expect(persistSnapshotMock).toHaveBeenCalled());
  });
});
