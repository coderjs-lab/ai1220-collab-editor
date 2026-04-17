import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InputField, SelectField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import { AIAssistantPanel } from '../ai/AIAssistantPanel';
import { useDocumentAi } from '../ai/useDocumentAi';
import { CollaborationPanel } from './CollaborationPanel';
import { CollaborativeEditorAdapter } from './CollaborativeEditorAdapter';
import { api, ApiError } from '../../services/api';
import type {
  ApiCollaborator,
  ApiDocument,
  ApiVersion,
} from '../../types/api';
import {
  countWords,
  formatCalendarTimestamp,
  formatCount,
  formatRelativeTimestamp,
} from '../../utils/format';
import { useCollaborationSession } from './useCollaborationSession';
import { richTextToPlainText } from './richText';
import { useCollaborativeEditor } from './useCollaborativeEditor';
import { useUnsavedChangesPrompt } from './useUnsavedChangesPrompt';

type EditorLoadState = 'loading' | 'ready' | 'forbidden' | 'notFound' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type AccessRole = 'owner' | 'editor' | 'viewer';
type ShareRole = 'viewer' | 'editor';
type EditorSidebarTab = 'access' | 'history' | 'assistant' | 'collaboration';

const sidebarTabs: Array<{ id: EditorSidebarTab; label: string }> = [
  { id: 'access', label: 'Access' },
  { id: 'history', label: 'History' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'collaboration', label: 'Collab' },
];

function sortCollaborators(collaborators: ApiCollaborator[]) {
  return [...collaborators].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === 'editor' ? -1 : 1;
    }

    return left.username.localeCompare(right.username);
  });
}

function PermissionPill({ role }: { role: AccessRole }) {
  const classes =
    role === 'owner'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : role === 'editor'
        ? 'border-teal-200 bg-teal-50 text-teal-950'
        : 'border-amber-200 bg-amber-50 text-amber-900';

  const label = role === 'owner' ? 'Owner' : role === 'editor' ? 'Can edit' : 'View only';

  return (
    <span
      className={[
        'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
        classes,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function SaveStatePill({
  saveState,
  isDirty,
  canEdit,
}: {
  saveState: SaveState;
  isDirty: boolean;
  canEdit: boolean;
}) {
  let className = 'border-[color:var(--border)] bg-white/75 text-[color:var(--text-soft)]';
  let label = 'Synced';

  if (!canEdit) {
    className = 'border-amber-200 bg-amber-50 text-amber-900';
    label = 'Read only';
  } else if (saveState === 'saving') {
    className = 'border-teal-200 bg-teal-50 text-teal-950';
    label = 'Saving';
  } else if (saveState === 'error') {
    className = 'border-red-200 bg-red-50 text-red-700';
    label = 'Save failed';
  } else if (isDirty) {
    className = 'border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] text-teal-900';
    label = 'Unsaved';
  }

  return (
    <span
      className={[
        'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function MetaChip({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-[color:var(--border)] bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
      {children}
    </span>
  );
}

function ToolTabButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        'rounded-[20px] border px-3 py-2.5 text-sm font-semibold transition',
        isActive
          ? 'border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] text-teal-950 shadow-[0_10px_24px_rgba(15,118,110,0.08)]'
          : 'border-[color:var(--border)] bg-white/75 text-[color:var(--text-soft)] hover:bg-white hover:text-[color:var(--text)]',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function VersionHistoryPanel({
  versions,
  selectedVersionId,
  isLoading,
  error,
  copyMessage,
  onRetry,
  onSelectVersion,
  onCopySnapshot,
  embedded = false,
}: {
  versions: ApiVersion[];
  selectedVersionId: number | null;
  isLoading: boolean;
  error: string | null;
  copyMessage: string | null;
  onRetry: () => void;
  onSelectVersion: (versionId: number) => void;
  onCopySnapshot: (version: ApiVersion) => void;
  embedded?: boolean;
}) {
  const activeVersion =
    versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;
  const containerClassName = embedded ? '' : 'shell-card rounded-[32px] p-5';

  return (
    <section className={containerClassName}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
          Version history
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
          Saved snapshots
        </h2>
        <p className="text-sm leading-6 text-[color:var(--text-soft)]">
          Review earlier saved states without replacing the current draft.
        </p>
      </div>

      {error ? (
        <div className="mt-5 space-y-3">
          <StatusBanner title={error} tone="danger" />
          <Button onClick={onRetry} variant="secondary">
            Retry history
          </Button>
        </div>
      ) : isLoading ? (
        <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-5 text-sm leading-6 text-[color:var(--text-soft)]">
          Loading saved versions...
        </div>
      ) : versions.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-5 text-sm leading-6 text-[color:var(--text-soft)]">
          No saved versions yet. A new snapshot appears after a content save replaces previous text.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="space-y-3">
            {versions.map((version) => (
              <button
                key={version.id}
                className={[
                  'w-full rounded-[24px] border px-4 py-3 text-left transition',
                  selectedVersionId === version.id
                    ? 'border-[color:var(--border-strong)] bg-[color:var(--teal-soft)]'
                    : 'border-[color:var(--border)] bg-white/80 hover:bg-white',
                ].join(' ')}
                onClick={() => onSelectVersion(version.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)]">
                      {version.created_by_username}
                    </p>
                    <p className="text-sm text-[color:var(--text-soft)]">
                      {formatRelativeTimestamp(version.created_at)}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                    Version #{version.id}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {activeVersion ? (
            <div className="rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text)]">
                    Snapshot preview
                  </p>
                  <p className="text-sm text-[color:var(--text-soft)]">
                    {formatCalendarTimestamp(activeVersion.created_at)}
                  </p>
                </div>
                <Button onClick={() => onCopySnapshot(activeVersion)} variant="ghost">
                  Copy snapshot
                </Button>
              </div>

              {copyMessage ? (
                <p className="mt-3 text-sm text-emerald-700">{copyMessage}</p>
              ) : null}

              <div className="editor-copy mt-4 max-h-64 overflow-auto rounded-[22px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,241,0.98))] px-4 py-4 text-[15px] leading-7 whitespace-pre-wrap text-[color:var(--text)]">
                {richTextToPlainText(activeVersion.content) || 'This snapshot is empty.'}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function EditorPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [loadState, setLoadState] = useState<EditorLoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [document, setDocument] = useState<ApiDocument | null>(null);
  const [collaborators, setCollaborators] = useState<ApiCollaborator[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [versionsReloadKey, setVersionsReloadKey] = useState(0);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<ShareRole>('viewer');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<number | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<EditorSidebarTab>('access');

  useEffect(() => {
    if (!id) {
      setLoadState('notFound');
      return;
    }

    let alive = true;

    setLoadState('loading');
    setLoadError(null);
    setDocument(null);
    setVersions([]);
    setSelectedVersionId(null);
    setCollaborators([]);
    setShareError(null);
    setShareMessage(null);
    setCopyMessage(null);

    api.documents
      .get(id)
      .then((response) => {
        if (!alive) {
          return;
        }

        setDocument(response.document);
        setCollaborators(sortCollaborators(response.collaborators));
        setDraftTitle(response.document.title);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (error instanceof ApiError) {
          if (error.status === 403) {
            setLoadState('forbidden');
            return;
          }

          if (error.status === 404) {
            setLoadState('notFound');
            return;
          }

          if (error.status === 401) {
            return;
          }

          setLoadError(error.error);
        } else {
          setLoadError('Could not open this document right now.');
        }

        setLoadState('error');
      });

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!document) {
      return;
    }

    let alive = true;
    setIsLoadingVersions(true);
    setVersionsError(null);

    api.documents
      .versions(String(document.id), true)
      .then((response) => {
        if (!alive) {
          return;
        }

        const sortedVersions = [...response.versions].sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        );

        setVersions(sortedVersions);
        setSelectedVersionId((current) => {
          if (current && sortedVersions.some((version) => version.id === current)) {
            return current;
          }

          return sortedVersions[0]?.id ?? null;
        });
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          return;
        }

        setVersionsError(
          error instanceof ApiError ? error.error : 'Could not load version history.',
        );
      })
      .finally(() => {
        if (alive) {
          setIsLoadingVersions(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [document, versionsReloadKey]);

  let permission: AccessRole = 'viewer';

  if (user && document) {
    if (document.owner_id === user.id) {
      permission = 'owner';
    } else {
      const collaborator = collaborators.find((entry) => entry.id === user.id);
      if (collaborator?.role === 'editor') {
        permission = 'editor';
      }
    }
  }

  const canEdit = permission === 'owner' || permission === 'editor';
  const canInvokeAi = permission === 'owner' || permission === 'editor';
  const ai = useDocumentAi(document ? String(document.id) : null);
  const collaborationSession = useCollaborationSession(document ? String(document.id) : null);
  const collaborativeEditor = useCollaborativeEditor({
    documentId: document ? String(document.id) : null,
    document,
    session: collaborationSession.session,
    title: draftTitle,
    canEdit,
    currentUser: user,
    onPersisted: (nextDocument) => {
      setDocument(nextDocument);
      setDraftTitle(nextDocument.title);
      setVersionsReloadKey((current) => current + 1);
    },
  });
  const isDirty = collaborativeEditor.isDirty;
  const wordCount = countWords(collaborativeEditor.plainText);
  const characterCount = collaborativeEditor.plainText.length;

  useUnsavedChangesPrompt(canEdit && isDirty);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!canEdit || !isDirty) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, isDirty, collaborativeEditor, draftTitle]);

  function resetTransientMessages() {
    collaborativeEditor.clearTransientSaveState();
    setShareError(null);
    setShareMessage(null);
    setCopyMessage(null);
  }

  async function handleSave() {
    if (!id || !document || !canEdit || !isDirty) {
      return;
    }

    await collaborativeEditor.persistSnapshot();
  }

  async function handleShare() {
    if (!id || permission !== 'owner') {
      return;
    }

    setIsSharing(true);
    setShareError(null);
    setShareMessage(null);

    try {
      const response = await api.documents.share(id, {
        email: shareEmail.trim(),
        role: shareRole,
      });

      setCollaborators((current) => {
        const others = current.filter((entry) => entry.id !== response.permission.user.id);
        return sortCollaborators([
          ...others,
          {
            ...response.permission.user,
            role: response.permission.role,
          },
        ]);
      });
      setShareEmail('');
      setShareRole('viewer');
      setShareMessage('Access updated successfully.');
    } catch (error) {
      if (error instanceof ApiError) {
        setShareError(error.error);
      } else {
        setShareError('Could not update access for that collaborator.');
      }
    } finally {
      setIsSharing(false);
    }
  }

  async function handleRevoke(userId: number) {
    if (!id || permission !== 'owner') {
      return;
    }

    setRevokingUserId(userId);
    setShareError(null);
    setShareMessage(null);

    try {
      await api.documents.revokeShare(id, userId);
      setCollaborators((current) => current.filter((entry) => entry.id !== userId));
      setShareMessage('Access removed successfully.');
    } catch (error) {
      if (error instanceof ApiError) {
        setShareError(error.error);
      } else {
        setShareError('Could not revoke access for that collaborator.');
      }
    } finally {
      setRevokingUserId(null);
    }
  }

  async function handleCopySnapshot(version: ApiVersion) {
    const plainText = richTextToPlainText(version.content);
    if (!plainText) {
      setCopyMessage('There is no snapshot text to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(plainText);
      setCopyMessage('Snapshot copied.');
    } catch {
      setCopyMessage('Clipboard access is unavailable in this browser.');
    }
  }

  function renderAccessPanel() {
    return (
      <section className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
            Access
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
            People with access
          </h2>
          <p className="text-sm leading-6 text-[color:var(--text-soft)]">
            Keep edit permissions intentional and easy to review.
          </p>
        </div>

        {shareError ? (
          <StatusBanner title={shareError} tone="danger" />
        ) : null}

        {shareMessage ? (
          <StatusBanner title={shareMessage} tone="success" />
        ) : null}

        {permission === 'owner' ? (
          <form
            className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleShare();
            }}
          >
            <InputField
              label="Invite by email"
              onChange={(event) => setShareEmail(event.target.value)}
              placeholder="teammate@example.com"
              type="email"
              value={shareEmail}
            />
            <SelectField
              label="Access level"
              onChange={(event) => setShareRole(event.target.value as ShareRole)}
              value={shareRole}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </SelectField>
            <Button disabled={isSharing} type="submit">
              {isSharing ? 'Updating access...' : 'Invite or update access'}
            </Button>
          </form>
        ) : (
          <div className="rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-4 text-sm leading-6 text-[color:var(--text-soft)]">
            Access is managed by the document owner.
          </div>
        )}

        <div className="space-y-3">
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm font-semibold text-emerald-950">
              {document.owner_id === user?.id ? 'You are the owner' : 'Owner'}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {document.owner_id === user?.id
                ? `${user?.username} · ${user?.email}`
                : 'This document is managed by another workspace member.'}
            </p>
          </div>

          {collaborators.length === 0 ? (
            <div className="rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-4 text-sm leading-6 text-[color:var(--text-soft)]">
              No additional collaborators yet.
            </div>
          ) : (
            collaborators.map((collaborator) => (
              <div
                key={collaborator.id}
                className="rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)]">
                      {collaborator.username}
                      {collaborator.id === user?.id ? ' (you)' : ''}
                    </p>
                    <p className="text-sm text-[color:var(--text-soft)]">{collaborator.email}</p>
                  </div>
                  <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                    {collaborator.role}
                  </span>
                </div>

                {permission === 'owner' ? (
                  <div className="mt-4">
                    <Button
                      disabled={revokingUserId === collaborator.id}
                      onClick={() => void handleRevoke(collaborator.id)}
                      variant="ghost"
                    >
                      {revokingUserId === collaborator.id ? 'Removing...' : 'Remove access'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderSidebarPanel() {
    if (activeSidebarTab === 'access') {
      return renderAccessPanel();
    }

    if (activeSidebarTab === 'history') {
      return (
        <VersionHistoryPanel
          copyMessage={copyMessage}
          embedded
          error={versionsError}
          isLoading={isLoadingVersions}
          onCopySnapshot={(version) => void handleCopySnapshot(version)}
          onRetry={() => {
            setVersionsReloadKey((current) => current + 1);
          }}
          onSelectVersion={setSelectedVersionId}
          selectedVersionId={selectedVersionId}
          versions={versions}
        />
      );
    }

    if (activeSidebarTab === 'assistant') {
      return (
        <AIAssistantPanel
          canApplySuggestion={canEdit && collaborativeEditor.saveState !== 'saving'}
          canInvoke={canInvokeAi}
          context={ai.context}
          embedded
          history={ai.history}
          historyError={ai.historyError}
          isLoadingHistory={ai.isLoadingHistory}
          isSuggesting={ai.isSuggesting}
          lastPrompt={ai.lastPrompt}
          onAppendSuggestion={handleAppendSuggestion}
          onContextChange={ai.setContext}
          onDismissSuggestion={ai.clearSuggestion}
          onPromptChange={ai.setPrompt}
          onReplaceDraft={handleReplaceWithSuggestion}
          onRetryHistory={ai.reloadHistory}
          onSubmit={() => {
            void ai.submitSuggestion();
          }}
          prompt={ai.prompt}
          promptError={ai.promptError}
          suggestError={ai.suggestError}
          suggestion={ai.suggestion}
        />
      );
    }

    return (
      <CollaborationPanel
        embedded
        message={collaborativeEditor.connectionMessage ?? collaborationSession.message}
        onRetrySession={collaborationSession.retry}
        presenceUsers={collaborativeEditor.presenceUsers}
        state={
          collaborationSession.status === 'loading'
            ? 'connecting'
            : collaborationSession.status === 'unavailable'
              ? 'error'
              : collaborativeEditor.connectionState
        }
      />
    );
  }

  function handleReplaceWithSuggestion(suggestion: string) {
    resetTransientMessages();
    collaborativeEditor.replaceWithSuggestion(suggestion);
  }

  function handleAppendSuggestion(suggestion: string) {
    resetTransientMessages();
    collaborativeEditor.appendSuggestion(suggestion);
  }

  if (loadState === 'loading') {
    return (
      <AppShell
        eyebrow="Document"
        subtitle="Opening your draft and loading the latest workspace details."
        title="Loading editor"
      >
        <EmptyState
          action={<Button disabled>Loading document...</Button>}
          description="Preparing the writing workspace."
          eyebrow="Loading"
          title="Opening your draft"
        />
      </AppShell>
    );
  }

  if (loadState === 'forbidden') {
    return (
      <AppShell
        eyebrow="Document"
        subtitle="This document is outside your current access level."
        title="Access blocked"
      >
        <EmptyState
          action={
            <Link
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] px-4 py-2.5 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
              to="/documents"
            >
              Back to documents
            </Link>
          }
          description="Ask the document owner to share access if you still need this draft."
          eyebrow="403"
          title="You do not have access to this document"
        />
      </AppShell>
    );
  }

  if (loadState === 'notFound') {
    return (
      <AppShell
        eyebrow="Document"
        subtitle="The document you requested could not be found."
        title="Document not found"
      >
        <EmptyState
          action={
            <Link
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] px-4 py-2.5 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
              to="/documents"
            >
              Return to dashboard
            </Link>
          }
          description="The link may be outdated, or the document may have been removed."
          eyebrow="404"
          title="This document does not exist"
        />
      </AppShell>
    );
  }

  if (loadState === 'error' || !document) {
    return (
      <AppShell
        eyebrow="Document"
        subtitle="The writing workspace could not be prepared."
        title="Editor unavailable"
      >
        <EmptyState
          action={
            <Button onClick={() => window.location.reload()} variant="secondary">
              Retry load
            </Button>
          }
          description={loadError ?? 'An unexpected error interrupted the editor.'}
          eyebrow="Unavailable"
          title="This document could not be opened"
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      actions={
        <>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--border)] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[color:var(--text)] transition hover:bg-white"
            to="/documents"
          >
            Back to documents
          </Link>
          <SaveStatePill
            canEdit={canEdit}
            isDirty={isDirty}
            saveState={collaborativeEditor.saveState}
          />
          <PermissionPill role={permission} />
          <Button
            disabled={!canEdit || !isDirty || collaborativeEditor.saveState === 'saving'}
            onClick={() => void handleSave()}
          >
            {collaborativeEditor.saveState === 'saving'
              ? 'Saving...'
              : canEdit
                ? isDirty
                  ? 'Save changes'
                  : 'Saved'
                : 'Read only'}
          </Button>
        </>
      }
      eyebrow="Document"
      subtitle="Collaborate in a shared editor, manage access, and review earlier saved states."
      title={draftTitle || 'Untitled'}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {!canEdit ? (
            <StatusBanner title="This document is read-only for your current access level." tone="warning">
              You can review the latest content and saved versions, but only the owner or an editor
              can make changes.
            </StatusBanner>
          ) : null}

          {collaborativeEditor.connectionState === 'reconnecting' ? (
            <StatusBanner
              title="The collaboration session is reconnecting."
              tone="warning"
            >
              Live updates will resume automatically when the socket reconnects.
            </StatusBanner>
          ) : null}

          {collaborativeEditor.connectionState === 'error' && collaborativeEditor.connectionMessage ? (
            <StatusBanner title={collaborativeEditor.connectionMessage} tone="danger" />
          ) : null}

          {collaborativeEditor.saveState === 'error' && collaborativeEditor.saveError ? (
            <StatusBanner title={collaborativeEditor.saveError} tone="danger" />
          ) : null}

          <section className="shell-card-strong rounded-[32px] p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap gap-2">
              <MetaChip>{`Doc #${document.id}`}</MetaChip>
              <MetaChip>{`Updated ${formatRelativeTimestamp(document.updated_at)}`}</MetaChip>
              <MetaChip>{formatCount(wordCount, 'word')}</MetaChip>
              <MetaChip>{formatCount(characterCount, 'character')}</MetaChip>
              <MetaChip>{`Session ${collaborativeEditor.connectionState}`}</MetaChip>
              {canEdit ? <MetaChip>{'Ctrl/Cmd + S to save'}</MetaChip> : null}
            </div>

            <div className="space-y-5">
              <InputField
                hint={
                  canEdit
                    ? `Last saved ${formatCalendarTimestamp(document.updated_at)}`
                    : 'This title is view-only.'
                }
                label="Title"
                onChange={(event) => {
                  resetTransientMessages();
                  setDraftTitle(event.target.value);
                }}
                readOnly={!canEdit || collaborativeEditor.saveState === 'saving'}
                value={draftTitle}
              />

              <CollaborativeEditorAdapter
                editor={collaborativeEditor.editor}
                hint="Live edits sync through the shared collaboration channel. Save when you want to checkpoint the current draft."
                readOnly={!canEdit}
              />
            </div>
          </section>
        </div>

        <aside className="self-start xl:sticky xl:top-6">
          <section className="shell-card rounded-[32px] p-4 sm:p-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
                  Workspace tools
                </p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
                  Switch document context fast
                </h2>
                <p className="text-sm leading-6 text-[color:var(--text-soft)]">
                  Move between access, history, assistant, and collaboration without chasing a
                  long sidebar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {sidebarTabs.map((tab) => (
                  <ToolTabButton
                    key={tab.id}
                    isActive={activeSidebarTab === tab.id}
                    label={tab.label}
                    onClick={() => setActiveSidebarTab(tab.id)}
                  />
                ))}
              </div>

              <div className="xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1">
                {renderSidebarPanel()}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
