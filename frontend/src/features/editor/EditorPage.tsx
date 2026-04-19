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
  ApiShareLink,
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
type SaveState = 'idle' | 'queued' | 'saving' | 'saved' | 'error';
type AccessRole = 'owner' | 'editor' | 'viewer';
type ShareRole = 'viewer' | 'editor';
type EditorSidebarTab = 'access' | 'history' | 'assistant' | 'collaboration';

const sidebarTabs: Array<{
  id: EditorSidebarTab;
  label: string;
  description: string;
}> = [
  { id: 'access', label: 'Access', description: 'People and shared links' },
  { id: 'history', label: 'History', description: 'Versions and restores' },
  { id: 'assistant', label: 'Assistant', description: 'AI drafting and review' },
  { id: 'collaboration', label: 'Collab', description: 'Presence and session state' },
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
        'inline-flex h-8 items-center justify-center rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
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
  } else if (saveState === 'queued' || isDirty) {
    className = 'border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] text-teal-900';
    label = 'Pending save';
  } else if (saveState === 'error') {
    className = 'border-red-200 bg-red-50 text-red-700';
    label = 'Save failed';
  }

  return (
    <span
      className={[
        'inline-flex h-8 items-center justify-center rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
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
      className={`workspace-tool-pill${isActive ? ' is-active' : ''}`}
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
  restoreMessage,
  canRestore,
  restoringVersionId,
  onRetry,
  onSelectVersion,
  onCopySnapshot,
  onRestoreVersion,
  embedded = false,
}: {
  versions: ApiVersion[];
  selectedVersionId: number | null;
  isLoading: boolean;
  error: string | null;
  copyMessage: string | null;
  restoreMessage: string | null;
  canRestore: boolean;
  restoringVersionId: number | null;
  onRetry: () => void;
  onSelectVersion: (versionId: number) => void;
  onCopySnapshot: (version: ApiVersion) => void;
  onRestoreVersion: (versionId: number) => void;
  embedded?: boolean;
}) {
  const activeVersion =
    versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;
  const containerClassName = embedded ? '' : 'shell-card rounded-[32px] p-5';
  const versionListClassName = embedded
    ? 'max-h-56 space-y-3 overflow-y-auto pr-1'
    : 'max-h-72 space-y-3 overflow-y-auto pr-1';

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
          <div className={versionListClassName}>
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

              {restoreMessage ? (
                <p className="mt-3 text-sm text-emerald-700">{restoreMessage}</p>
              ) : null}

              <div className="editor-copy mt-4 max-h-64 overflow-auto rounded-[22px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,241,0.98))] px-4 py-4 text-[15px] leading-7 whitespace-pre-wrap text-[color:var(--text)]">
                {richTextToPlainText(activeVersion.content) || 'This snapshot is empty.'}
              </div>

              {canRestore ? (
                <div className="mt-4">
                  <Button
                    disabled={restoringVersionId === activeVersion.id}
                    onClick={() => onRestoreVersion(activeVersion.id)}
                    variant="secondary"
                  >
                    {restoringVersionId === activeVersion.id ? 'Restoring...' : 'Restore version'}
                  </Button>
                </div>
              ) : null}
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
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [shareIdentifier, setShareIdentifier] = useState('');
  const [shareRole, setShareRole] = useState<ShareRole>('viewer');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<number | null>(null);
  const [shareLinks, setShareLinks] = useState<ApiShareLink[]>([]);
  const [isLoadingShareLinks, setIsLoadingShareLinks] = useState(false);
  const [shareLinkRole, setShareLinkRole] = useState<ShareRole>('viewer');
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [revokingShareLinkId, setRevokingShareLinkId] = useState<number | null>(null);
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
    setShareLinks([]);
    setShareError(null);
    setShareMessage(null);
    setCopyMessage(null);
    setRestoreMessage(null);

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

  useEffect(() => {
    if (!document || !user || document.owner_id !== user.id) {
      setShareLinks([]);
      return;
    }

    let alive = true;
    setIsLoadingShareLinks(true);

    api.shareLinks
      .list(String(document.id))
      .then((response) => {
        if (!alive) {
          return;
        }

        setShareLinks(response.share_links);
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          return;
        }

        setShareError(
          error instanceof ApiError ? error.error : 'Could not load active share links.',
        );
      })
      .finally(() => {
        if (alive) {
          setIsLoadingShareLinks(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [document, user]);

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
  const ai = useDocumentAi(
    document ? String(document.id) : null,
    collaborativeEditor.selectionText,
    collaborativeEditor.plainText,
  );
  const isDirty = collaborativeEditor.isDirty;
  const wordCount = countWords(collaborativeEditor.plainText);
  const characterCount = collaborativeEditor.plainText.length;
  const isSavingNow = collaborativeEditor.saveState === 'saving';
  const saveButtonVariant = canEdit && isDirty ? 'primary' : isSavingNow ? 'secondary' : 'ghost';
  const saveButtonClassName = [
    'h-8 min-h-0 px-4 py-1 !text-xs font-semibold leading-none uppercase tracking-[0.18em]',
    canEdit && isDirty
      ? '!text-white'
      : 'border-[color:var(--border)] bg-white/75 text-[color:var(--text-soft)] shadow-none hover:shadow-none disabled:!opacity-100',
  ].join(' ');

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
    setRestoreMessage(null);
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
      if (error instanceof ApiError) {
        setShareError(error.error);
      } else {
        setShareError('Could not update access for that collaborator.');
      }
    } finally {
      setIsSharing(false);
    }
  }

  async function handleCreateShareLink() {
    if (!id || permission !== 'owner') {
      return;
    }

    setIsCreatingShareLink(true);
    setShareError(null);
    setShareMessage(null);

    try {
      const response = await api.shareLinks.create(id, { role: shareLinkRole });
      setShareLinks((current) => [response.share_link, ...current.filter((entry) => entry.id !== response.share_link.id)]);
      await navigator.clipboard.writeText(response.share_link.url);
      setShareMessage('Share link created and copied to your clipboard.');
    } catch (error) {
      if (error instanceof ApiError) {
        setShareError(error.error);
      } else {
        setShareError('Could not create a share link right now.');
      }
    } finally {
      setIsCreatingShareLink(false);
    }
  }

  async function handleCopyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage('Share link copied to your clipboard.');
    } catch {
      setShareError('Clipboard access is unavailable in this browser.');
    }
  }

  async function handleRevokeShareLink(linkId: number) {
    if (!id || permission !== 'owner') {
      return;
    }

    setRevokingShareLinkId(linkId);
    setShareError(null);
    setShareMessage(null);

    try {
      await api.shareLinks.revoke(id, linkId);
      setShareLinks((current) => current.filter((entry) => entry.id !== linkId));
      setShareMessage('Share link revoked successfully.');
    } catch (error) {
      if (error instanceof ApiError) {
        setShareError(error.error);
      } else {
        setShareError('Could not revoke that share link.');
      }
    } finally {
      setRevokingShareLinkId(null);
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

  async function handleRestoreVersion(versionId: number) {
    if (!id || !document || !canEdit) {
      return;
    }

    setRestoringVersionId(versionId);
    setVersionsError(null);
    setCopyMessage(null);
    setRestoreMessage(null);

    try {
      const response = await api.documents.restoreVersion(id, versionId);
      collaborativeEditor.applyServerDocument(response.document);
      setDocument(response.document);
      setDraftTitle(response.document.title);
      setVersionsReloadKey((current) => current + 1);
      setRestoreMessage('Version restored into the current draft.');
    } catch (error) {
      setVersionsError(
        error instanceof ApiError ? error.error : 'Could not restore that version.',
      );
    } finally {
      setRestoringVersionId(null);
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
          <div className="space-y-4">
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

            <div className="space-y-4 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[color:var(--text)]">Share by link</p>
                <p className="text-sm leading-6 text-[color:var(--text-soft)]">
                  Create a reusable viewer or editor link, then revoke it whenever the window closes.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <SelectField
                  label="Link role"
                  onChange={(event) => setShareLinkRole(event.target.value as ShareRole)}
                  value={shareLinkRole}
                >
                  <option value="viewer">Viewer link</option>
                  <option value="editor">Editor link</option>
                </SelectField>
                <div className="self-end">
                  <Button disabled={isCreatingShareLink} onClick={() => void handleCreateShareLink()} type="button">
                    {isCreatingShareLink ? 'Creating...' : 'Create link'}
                  </Button>
                </div>
              </div>

              {isLoadingShareLinks ? (
                <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-4 py-4 text-sm text-[color:var(--text-soft)]">
                  Loading active share links...
                </div>
              ) : shareLinks.length === 0 ? (
                <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-4 py-4 text-sm text-[color:var(--text-soft)]">
                  No active share links yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {shareLinks.map((shareLink) => (
                    <div
                      key={shareLink.id}
                      className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[color:var(--text)]">
                            {shareLink.role === 'editor' ? 'Editor link' : 'Viewer link'}
                          </p>
                          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                            Created {formatRelativeTimestamp(shareLink.created_at)}
                          </p>
                          <p className="break-all text-sm text-[color:var(--text-soft)]">
                            {shareLink.url}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => void handleCopyShareLink(shareLink.url)}
                            type="button"
                            variant="secondary"
                          >
                            Copy link
                          </Button>
                          <Button
                            disabled={revokingShareLinkId === shareLink.id}
                            onClick={() => void handleRevokeShareLink(shareLink.id)}
                            type="button"
                            variant="ghost"
                          >
                            {revokingShareLinkId === shareLink.id ? 'Revoking...' : 'Revoke'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          canRestore={canEdit}
          copyMessage={copyMessage}
          embedded
          error={versionsError}
          isLoading={isLoadingVersions}
          onCopySnapshot={(version) => void handleCopySnapshot(version)}
          onRestoreVersion={(versionId) => void handleRestoreVersion(versionId)}
          onRetry={() => {
            setVersionsReloadKey((current) => current + 1);
          }}
          onSelectVersion={setSelectedVersionId}
          restoreMessage={restoreMessage}
          restoringVersionId={restoringVersionId}
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
          canUndoAiApply={collaborativeEditor.canUndoAiApply}
          context={ai.context}
          embedded
          feature={ai.feature}
          hasSelectionContext={ai.hasSelectionContext}
          history={ai.history}
          historyError={ai.historyError}
          isLoadingHistory={ai.isLoadingHistory}
          isSuggesting={ai.isSuggesting}
          lastPrompt={ai.lastPrompt}
          lastModel={ai.lastModel}
          onApplySelectedFragment={handleApplySuggestionFragment}
          onAppendSuggestion={handleAppendSuggestion}
          onApplyAcceptedParts={handleApplyAcceptedSuggestion}
          onContextChange={ai.setContext}
          onFeatureChange={ai.setFeature}
          onCancel={ai.cancelSuggestion}
          onDismissSuggestion={ai.clearSuggestion}
          onPromptChange={ai.setPrompt}
          onRejectSuggestion={handleRejectSuggestion}
          onReplaceDraft={handleReplaceWithSuggestion}
          onReplaceSelection={handleReplaceSelectionWithSuggestion}
          onRetryHistory={ai.reloadHistory}
          onSuggestionChange={ai.setSuggestion}
          onSummaryFormatChange={ai.setSummaryFormat}
          onSummaryLengthChange={ai.setSummaryLength}
          onSubmit={() => {
            void ai.submitSuggestion();
          }}
          onToneChange={ai.setTone}
          onUndoApply={collaborativeEditor.undoLastAiApply}
          prompt={ai.prompt}
          promptError={ai.promptError}
          suggestionSourceText={ai.suggestionSourceText}
          suggestError={ai.suggestError}
          suggestion={ai.suggestion}
          summaryFormat={ai.summaryFormat}
          summaryLength={ai.summaryLength}
          tone={ai.tone}
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
    void ai.recordDecision(ai.isSuggestionEdited ? 'edited' : 'accepted');
  }

  function handleAppendSuggestion(suggestion: string) {
    resetTransientMessages();
    collaborativeEditor.appendSuggestion(suggestion);
    void ai.recordDecision(ai.isSuggestionEdited ? 'edited' : 'accepted');
  }

  function handleReplaceSelectionWithSuggestion(suggestion: string) {
    resetTransientMessages();
    collaborativeEditor.replaceSelectionWithSuggestion(suggestion);
    void ai.recordDecision(ai.isSuggestionEdited ? 'edited' : 'accepted');
  }

  function handleApplySuggestionFragment(fragment: string) {
    resetTransientMessages();
    collaborativeEditor.replaceSelectionWithSuggestion(fragment);
    void ai.recordDecision('partial');
  }

  function handleApplyAcceptedSuggestion(
    suggestion: string,
    mode: 'replace-selection' | 'replace-draft' | 'append',
  ) {
    resetTransientMessages();

    if (mode === 'replace-selection') {
      collaborativeEditor.replaceSelectionWithSuggestion(suggestion);
    } else if (mode === 'replace-draft') {
      collaborativeEditor.replaceWithSuggestion(suggestion);
    } else {
      collaborativeEditor.appendSuggestion(suggestion);
    }

    void ai.recordDecision('partial');
  }

  function handleRejectSuggestion() {
    void ai.recordDecision('rejected');
    ai.clearSuggestion();
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
      hidePageIntro
      topBarActions={
        <>
          <Link
            className="inline-flex h-8 items-center justify-center rounded-full bg-teal-900 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] !text-white shadow-[0_10px_24px_rgba(15,118,110,0.18)] transition hover:bg-teal-950 hover:!text-white hover:shadow-[0_14px_28px_rgba(15,118,110,0.22)]"
            to="/documents"
          >
            Documents
          </Link>
          <SaveStatePill
            canEdit={canEdit}
            isDirty={isDirty}
            saveState={collaborativeEditor.saveState}
          />
          <PermissionPill role={permission} />
          <Button
            className={saveButtonClassName}
            disabled={!canEdit || !isDirty || isSavingNow}
            onClick={() => void handleSave()}
            variant={saveButtonVariant}
          >
            {isSavingNow
              ? 'Saving...'
              : canEdit
                ? isDirty
                  ? 'Save now'
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

          {collaborativeEditor.saveState === 'queued' && collaborativeEditor.saveMessage ? (
            <StatusBanner title={collaborativeEditor.saveMessage} tone="warning" />
          ) : null}

          <section className="shell-card-strong rounded-[32px] p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap gap-2">
              <MetaChip>{`Doc #${document.id}`}</MetaChip>
              <MetaChip>{`Updated ${formatRelativeTimestamp(document.updated_at)}`}</MetaChip>
              <MetaChip>{formatCount(wordCount, 'word')}</MetaChip>
              <MetaChip>{formatCount(characterCount, 'character')}</MetaChip>
              <MetaChip>{`Session ${collaborativeEditor.connectionState}`}</MetaChip>
              {canEdit ? <MetaChip>{'Autosave is on'}</MetaChip> : null}
              {canEdit ? <MetaChip>{'Ctrl/Cmd + S saves now'}</MetaChip> : null}
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
                hint="Live edits sync through the shared collaboration channel and autosave after a short pause. Save now whenever you want an immediate checkpoint."
                readOnly={!canEdit}
              />
            </div>
          </section>
        </div>

        <aside className="self-start xl:sticky xl:top-6">
          <section className="shell-card rounded-[32px] p-4 sm:p-5">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
                  Workspace tools
                </p>
              </div>

              <div className="workspace-tool-grid">
                {sidebarTabs.map((tab) => (
                  <ToolTabButton
                    key={tab.id}
                    isActive={activeSidebarTab === tab.id}
                    label={tab.label}
                    onClick={() => setActiveSidebarTab(tab.id)}
                  />
                ))}
              </div>

              <div className="workspace-tool-panel xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1">
                {renderSidebarPanel()}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
