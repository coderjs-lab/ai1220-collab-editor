import { useEffect, useEffectEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InputField, SelectField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import { api, ApiError } from '../../services/api';
import type { ApiCollaborator, ApiDocument, ApiVersion } from '../../types/api';
import {
  countWords,
  formatCalendarTimestamp,
  formatRelativeTimestamp,
  htmlToText,
  plainTextToHtml,
} from '../../utils/format';
import { AIAssistantPanel } from '../ai/AIAssistantPanel';
import { useDocumentAi } from '../ai/useDocumentAi';
import { CollaborationReadinessPanel } from './CollaborationReadinessPanel';
import { RichTextEditor } from './RichTextEditor';
import { useCollaborationSession } from './useCollaborationSession';
import { useUnsavedChangesPrompt } from './useUnsavedChangesPrompt';

type EditorLoadState = 'loading' | 'ready' | 'forbidden' | 'notFound' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type AccessRole = 'owner' | 'editor' | 'viewer';
type ShareRole = 'viewer' | 'editor';
type EditorSidebarTab = 'access' | 'history' | 'assistant' | 'collaboration';

const EMPTY_DOCUMENT_HTML = '<p></p>';
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

function normalizeContent(value: string) {
  const trimmed = value.trim();
  return trimmed || EMPTY_DOCUMENT_HTML;
}

function draftDiffersFromDocument(
  document: ApiDocument | null,
  draftTitle: string,
  draftContent: string,
) {
  if (!document) {
    return false;
  }

  return (
    (draftTitle.trim() || 'Untitled') !== document.title ||
    normalizeContent(draftContent) !== normalizeContent(document.content)
  );
}

function resolvePermission(
  document: ApiDocument | null,
  collaborators: ApiCollaborator[],
  currentUserId: number | undefined,
): AccessRole {
  if (!document || !currentUserId) {
    return 'viewer';
  }

  if (document.owner_id === currentUserId) {
    return 'owner';
  }

  const collaborator = collaborators.find((entry) => entry.id === currentUserId);
  return collaborator?.role ?? 'viewer';
}

function PermissionPill({ role }: { role: AccessRole | ShareRole }) {
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
  let label = 'Saved';

  if (!canEdit) {
    className = 'border-amber-200 bg-amber-50 text-amber-900';
    label = 'Read only';
  } else if (saveState === 'saving') {
    className = 'border-teal-200 bg-teal-50 text-teal-950';
    label = 'Saving';
  } else if (saveState === 'error') {
    className = 'border-red-200 bg-red-50 text-red-700';
    label = 'Retry needed';
  } else if (isDirty) {
    className = 'border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] text-teal-900';
    label = 'Unsaved changes';
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
  canRestore,
  restoringVersionId,
  copyMessage,
  restoreMessage,
  onRetry,
  onSelectVersion,
  onCopySnapshot,
  onRestoreVersion,
}: {
  versions: ApiVersion[];
  selectedVersionId: number | null;
  isLoading: boolean;
  error: string | null;
  canRestore: boolean;
  restoringVersionId: number | null;
  copyMessage: string | null;
  restoreMessage: string | null;
  onRetry: () => void;
  onSelectVersion: (versionId: number) => void;
  onCopySnapshot: (version: ApiVersion) => void;
  onRestoreVersion: (versionId: number) => void;
}) {
  const activeVersion =
    versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;

  if (error) {
    return (
      <div className="space-y-3">
        <StatusBanner title={error} tone="danger" />
        <Button onClick={onRetry} variant="secondary">
          Retry history
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-5 text-sm leading-6 text-[color:var(--text-soft)]">
        Loading saved versions...
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-5 text-sm leading-6 text-[color:var(--text-soft)]">
        No saved versions yet. A snapshot appears after the first saved content change.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {copyMessage ? <StatusBanner title={copyMessage} tone="success" /> : null}
      {restoreMessage ? <StatusBanner title={restoreMessage} tone="success" /> : null}

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
              <p className="text-sm font-semibold text-[color:var(--text)]">Snapshot preview</p>
              <p className="text-sm text-[color:var(--text-soft)]">
                {formatCalendarTimestamp(activeVersion.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onCopySnapshot(activeVersion)} variant="ghost">
                Copy text
              </Button>
              {canRestore ? (
                <Button
                  data-testid="restore-version-button"
                  disabled={restoringVersionId === activeVersion.id}
                  onClick={() => onRestoreVersion(activeVersion.id)}
                  variant="secondary"
                >
                  {restoringVersionId === activeVersion.id ? 'Restoring...' : 'Restore version'}
                </Button>
              ) : null}
            </div>
          </div>

          <div
            className="rich-preview mt-4 max-h-64 overflow-auto rounded-[22px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,241,0.98))] px-4 py-4"
            dangerouslySetInnerHTML={{
              __html: activeVersion.content?.trim() || '<p>This snapshot is empty.</p>',
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loadState, setLoadState] = useState<EditorLoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [document, setDocument] = useState<ApiDocument | null>(null);
  const [collaborators, setCollaborators] = useState<ApiCollaborator[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState(EMPTY_DOCUMENT_HTML);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareIdentifier, setShareIdentifier] = useState('');
  const [shareRole, setShareRole] = useState<ShareRole>('viewer');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionsReloadKey, setVersionsReloadKey] = useState(0);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorSidebarTab>('access');

  const ai = useDocumentAi(id ?? null);
  const collaboration = useCollaborationSession(id ?? null);

  const isDirty = draftDiffersFromDocument(document, draftTitle, draftContent);
  useUnsavedChangesPrompt(loadState === 'ready' && isDirty);

  useEffect(() => {
    if (!id) {
      setLoadState('notFound');
      return;
    }

    let alive = true;
    setLoadState('loading');
    setLoadError(null);

    api.documents
      .get(id)
      .then((response) => {
        if (!alive) {
          return;
        }

        const nextCollaborators = sortCollaborators(response.collaborators);
        setDocument(response.document);
        setCollaborators(nextCollaborators);
        setDraftTitle(response.document.title);
        setDraftContent(normalizeContent(response.document.content));
        setSaveState('saved');
        setSaveError(null);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          setLoadState('forbidden');
          return;
        }

        if (error instanceof ApiError && error.status === 404) {
          setLoadState('notFound');
          return;
        }

        setLoadState('error');
        setLoadError(error instanceof ApiError ? error.error : 'Could not load the editor.');
      });

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id || loadState !== 'ready') {
      return;
    }

    let alive = true;
    setIsLoadingVersions(true);
    setVersionsError(null);

    api.documents
      .versions(id, true)
      .then((response) => {
        if (!alive) {
          return;
        }

        const sortedVersions = [...response.versions].sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        );
        setVersions(sortedVersions);
        setSelectedVersionId((current) =>
          current && sortedVersions.some((version) => version.id === current)
            ? current
            : sortedVersions[0]?.id ?? null,
        );
      })
      .catch((error) => {
        if (!alive) {
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
  }, [id, loadState, versionsReloadKey]);

  const permission = resolvePermission(document, collaborators, user?.id);
  const canEdit = permission === 'owner' || permission === 'editor';
  const canShare = permission === 'owner';
  const canRestore = permission === 'owner' || permission === 'editor';

  const persistDraft = useEffectEvent(async () => {
    if (!id || !document || !canEdit || !draftDiffersFromDocument(document, draftTitle, draftContent)) {
      return;
    }

    setSaveState('saving');
    setSaveError(null);

    try {
      const response = await api.documents.update(id, {
        title: draftTitle.trim() || 'Untitled',
        content: normalizeContent(draftContent),
      });

      setDocument(response.document);
      setDraftTitle(response.document.title);
      setDraftContent(normalizeContent(response.document.content));
      setSaveState('saved');
      setVersionsReloadKey((current) => current + 1);
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof ApiError ? error.error : 'Could not save your changes.');
    }
  });

  useEffect(() => {
    if (!document || !canEdit || !isDirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [canEdit, document, draftTitle, draftContent, isDirty, persistDraft]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!canEdit || !isDirty) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void persistDraft();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, isDirty, persistDraft]);

  async function handleShare() {
    if (!id || !canShare) {
      return;
    }

    setIsSharing(true);
    setShareError(null);
    setShareMessage(null);

    try {
      const response = await api.documents.share(id, {
        identifier: shareIdentifier.trim(),
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
      setShareIdentifier('');
      setShareRole('viewer');
      setShareMessage('Access updated successfully.');
    } catch (error) {
      setShareError(
        error instanceof ApiError
          ? error.error
          : 'Could not update access for that collaborator.',
      );
    } finally {
      setIsSharing(false);
    }
  }

  async function handleRevoke(userId: number) {
    if (!id || !canShare) {
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
      setShareError(
        error instanceof ApiError
          ? error.error
          : 'Could not revoke access for that collaborator.',
      );
    } finally {
      setRevokingUserId(null);
    }
  }

  async function handleCopySnapshot(version: ApiVersion) {
    const text = htmlToText(version.content ?? '');
    if (!text) {
      setCopyMessage('This snapshot is empty.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('Snapshot copied.');
    } catch {
      setCopyMessage('Clipboard access is unavailable in this browser.');
    }
  }

  async function handleRestoreVersion(versionId: number) {
    if (!id || !canRestore) {
      return;
    }

    setRestoringVersionId(versionId);
    setVersionsError(null);
    setRestoreMessage(null);

    try {
      const response = await api.documents.restoreVersion(id, versionId);
      setDocument(response.document);
      setDraftTitle(response.document.title);
      setDraftContent(normalizeContent(response.document.content));
      setRestoreMessage('Version restored into the current draft.');
      setSaveState('saved');
      setVersionsReloadKey((current) => current + 1);
    } catch (error) {
      setVersionsError(
        error instanceof ApiError ? error.error : 'Could not restore that version.',
      );
    } finally {
      setRestoringVersionId(null);
    }
  }

  function applySuggestedReplacement(suggestion: string) {
    setDraftContent(plainTextToHtml(suggestion));
    setSaveState('idle');
    ai.clearSuggestion();
  }

  function appendSuggestion(suggestion: string) {
    setDraftContent((current) => `${normalizeContent(current)}${plainTextToHtml(suggestion)}`);
    setSaveState('idle');
    ai.clearSuggestion();
  }

  async function handleDelete() {
    if (!id || permission !== 'owner') {
      return;
    }

    try {
      await api.documents.remove(id);
      navigate('/documents');
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.error : 'Could not delete this document.');
    }
  }

  if (loadState === 'loading') {
    return (
      <AppShell
        eyebrow="Workspace"
        title="Loading editor"
        subtitle="Pulling the latest document, access settings, and saved versions."
      >
        <div className="shell-card rounded-[32px] px-5 py-8 text-sm text-[color:var(--text-soft)]">
          Preparing your workspace...
        </div>
      </AppShell>
    );
  }

  if (loadState === 'forbidden') {
    return (
      <AppShell
        eyebrow="Workspace"
        title="Access restricted"
        subtitle="This document is not currently shared with your account."
      >
        <EmptyState
          action={
            <Link
              className="inline-flex rounded-full border border-[color:var(--border)] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[color:var(--text)]"
              to="/documents"
            >
              Back to documents
            </Link>
          }
          description="Ask the document owner to share access if you still need this draft."
          eyebrow="Permission"
          title="You cannot open this document"
        />
      </AppShell>
    );
  }

  if (loadState === 'notFound') {
    return (
      <AppShell
        eyebrow="Workspace"
        title="Document missing"
        subtitle="The requested draft could not be found."
      >
        <EmptyState
          action={
            <Link
              className="inline-flex rounded-full border border-[color:var(--border)] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[color:var(--text)]"
              to="/documents"
            >
              Back to documents
            </Link>
          }
          description="This draft may have been deleted or moved."
          eyebrow="Not found"
          title="The document is gone"
        />
      </AppShell>
    );
  }

  if (loadState === 'error' || !document) {
    return (
      <AppShell
        eyebrow="Workspace"
        title="Editor unavailable"
        subtitle="The workspace could not be prepared for this document."
      >
        <StatusBanner title={loadError ?? 'An unexpected error interrupted the editor.'} tone="danger" />
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Document"
      title={draftTitle || 'Untitled'}
      subtitle="Write with rich text, share selectively, and let autosave keep your latest changes protected."
      actions={
        <>
          <PermissionPill role={permission} />
          <SaveStatePill canEdit={canEdit} isDirty={isDirty} saveState={saveState} />
          <Button disabled={!canEdit || !isDirty} onClick={() => void persistDraft()} variant="secondary">
            Save now
          </Button>
          {permission === 'owner' ? (
            <Button onClick={() => void handleDelete()} variant="danger">
              Delete
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.9fr)]">
        <section className="space-y-5">
          {saveError ? <StatusBanner title={saveError} tone="danger" /> : null}
          {!canEdit ? (
            <StatusBanner title="This document is open in view-only mode." tone="warning">
              You can read the document, version history, and AI history, but only owners and
              editors can change content.
            </StatusBanner>
          ) : null}

          <div className="shell-card rounded-[32px] p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <InputField
                label="Document title"
                onBlur={() => {
                  void persistDraft();
                }}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setSaveState('idle');
                }}
                placeholder="Untitled"
                value={draftTitle}
              />

              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                <span className="rounded-full border border-[color:var(--border)] bg-white/75 px-3 py-1">
                  {countWords(draftContent)} words
                </span>
                <span className="rounded-full border border-[color:var(--border)] bg-white/75 px-3 py-1">
                  Updated {formatRelativeTimestamp(document.updated_at)}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <RichTextEditor
                editable={canEdit}
                onBlur={() => {
                  void persistDraft();
                }}
                onChange={(nextValue) => {
                  setDraftContent(normalizeContent(nextValue));
                  setSaveState('idle');
                }}
                value={draftContent}
              />
            </div>
          </div>
        </section>

        <aside className="shell-card rounded-[32px] p-5">
          <div className="flex flex-wrap gap-2">
            {sidebarTabs.map((tab) => (
              <ToolTabButton
                key={tab.id}
                isActive={activeTab === tab.id}
                label={tab.label}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          <div className="mt-5 space-y-5">
            {activeTab === 'access' ? (
              <section className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
                    Access
                  </p>
                  <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
                    People with access
                  </h2>
                  <p className="text-sm leading-6 text-[color:var(--text-soft)]">
                    Owners manage sharing. Editors can modify content and viewers stay read-only.
                  </p>
                </div>

                {shareError ? <StatusBanner title={shareError} tone="danger" /> : null}
                {shareMessage ? <StatusBanner title={shareMessage} tone="success" /> : null}

                {canShare ? (
                  <form
                    className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleShare();
                    }}
                  >
                    <InputField
                      label="Invite by email or username"
                      onChange={(event) => setShareIdentifier(event.target.value)}
                      placeholder="teammate@example.com or teammate"
                      value={shareIdentifier}
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
                      {document.owner_id === user?.id ? 'You own this document.' : 'Document owner'}
                    </p>
                    <p className="mt-1 text-sm text-emerald-900/80">
                      Owners can share, delete, restore versions, and invoke the assistant.
                    </p>
                  </div>

                  {collaborators.length === 0 ? (
                    <div className="rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-4 text-sm leading-6 text-[color:var(--text-soft)]">
                      No collaborators yet.
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
                            </p>
                            <p className="text-sm text-[color:var(--text-soft)]">
                              {collaborator.email}
                            </p>
                          </div>
                          <PermissionPill role={collaborator.role} />
                        </div>

                        {canShare ? (
                          <div className="mt-3">
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
            ) : null}

            {activeTab === 'history' ? (
              <section className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
                    Version history
                  </p>
                  <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
                    Saved snapshots
                  </h2>
                  <p className="text-sm leading-6 text-[color:var(--text-soft)]">
                    Review previous saves and restore a version when you need to rewind safely.
                  </p>
                </div>

                <VersionHistoryPanel
                  canRestore={canRestore}
                  copyMessage={copyMessage}
                  error={versionsError}
                  isLoading={isLoadingVersions}
                  onCopySnapshot={handleCopySnapshot}
                  onRestoreVersion={(versionId) => void handleRestoreVersion(versionId)}
                  onRetry={() => setVersionsReloadKey((current) => current + 1)}
                  onSelectVersion={setSelectedVersionId}
                  restoreMessage={restoreMessage}
                  restoringVersionId={restoringVersionId}
                  selectedVersionId={selectedVersionId}
                  versions={versions}
                />
              </section>
            ) : null}

            {activeTab === 'assistant' ? (
              <AIAssistantPanel
                canApplySuggestion={canEdit}
                canInvoke={permission === 'owner' || permission === 'editor'}
                context={ai.context}
                embedded
                history={ai.history}
                historyError={ai.historyError}
                isLoadingHistory={ai.isLoadingHistory}
                isSuggesting={ai.isSuggesting}
                lastPrompt={ai.lastPrompt}
                onAppendSuggestion={appendSuggestion}
                onContextChange={ai.setContext}
                onDismissSuggestion={ai.clearSuggestion}
                onPromptChange={ai.setPrompt}
                onReplaceDraft={applySuggestedReplacement}
                onRetryHistory={ai.reloadHistory}
                onSubmit={() => {
                  void ai.submitSuggestion();
                }}
                prompt={ai.prompt}
                promptError={ai.promptError}
                suggestError={ai.suggestError}
                suggestion={ai.suggestion}
              />
            ) : null}

            {activeTab === 'collaboration' ? (
              <CollaborationReadinessPanel
                embedded
                expiresIn={collaboration.expiresIn}
                message={collaboration.message}
                onRetry={collaboration.retry}
                status={collaboration.status}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
