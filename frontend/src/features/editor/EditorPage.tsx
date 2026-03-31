import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InputField, TextareaField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import { api, ApiError } from '../../services/api';
import type { ApiCollaborator, ApiDocument } from '../../types/api';
import { formatRelativeTimestamp } from '../../utils/format';
import { useAuth } from '../../app/AuthProvider';

type EditorLoadState = 'loading' | 'ready' | 'forbidden' | 'notFound' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function PermissionPill({ role }: { role: 'owner' | 'editor' | 'viewer' }) {
  const classes =
    role === 'owner'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : role === 'editor'
        ? 'border-teal-200 bg-teal-50 text-teal-950'
        : 'border-amber-200 bg-amber-50 text-amber-900';

  const label = role === 'owner' ? 'Owner' : role === 'editor' ? 'Can edit' : 'View only';

  return (
    <span className={['rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]', classes].join(' ')}>
      {label}
    </span>
  );
}

export function EditorPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [loadState, setLoadState] = useState<EditorLoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [document, setDocument] = useState<ApiDocument | null>(null);
  const [collaborators, setCollaborators] = useState<ApiCollaborator[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

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

        setDocument(response.document);
        setCollaborators(response.collaborators);
        setDraftTitle(response.document.title);
        setDraftContent(response.document.content);
        setLoadState('ready');
        setSaveState('idle');
        setSaveError(null);
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
          setLoadError('Could not load the document from the backend.');
        }

        setLoadState('error');
      });

    return () => {
      alive = false;
    };
  }, [id]);

  let permission: 'owner' | 'editor' | 'viewer' = 'viewer';
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
  const isDirty = document
    ? draftTitle !== document.title || draftContent !== document.content
    : false;

  async function handleSave() {
    if (!id || !document || !canEdit || !isDirty) {
      return;
    }

    setSaveState('saving');
    setSaveError(null);

    try {
      const response = await api.documents.update(id, {
        title: draftTitle,
        content: draftContent,
      });
      setDocument(response.document);
      setDraftTitle(response.document.title);
      setDraftContent(response.document.content);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      if (error instanceof ApiError) {
        setSaveError(error.error);
      } else {
        setSaveError('Could not save the document.');
      }
    }
  }

  if (loadState === 'loading') {
    return (
      <AppShell
        subtitle="Fetching the selected document and collaborator list from the backend."
        title="Loading editor"
      >
        <EmptyState
          action={<Button disabled>Loading document...</Button>}
          description="The frontend is waiting for `GET /api/documents/:id` to return the document payload and collaborator list."
          eyebrow="Loading"
          title="Opening the editor shell"
        />
      </AppShell>
    );
  }

  if (loadState === 'forbidden') {
    return (
      <AppShell
        subtitle="The backend denied access to this document for the current authenticated user."
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
          description="This document is outside your current permissions according to the backend authorization rules."
          eyebrow="403"
          title="You do not have access to this document"
        />
      </AppShell>
    );
  }

  if (loadState === 'notFound') {
    return (
      <AppShell
        subtitle="No document matched the requested identifier."
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
          description="The backend returned a not-found response for this document id."
          eyebrow="404"
          title="This document does not exist"
        />
      </AppShell>
    );
  }

  if (loadState === 'error' || !document) {
    return (
      <AppShell
        subtitle="The frontend could not complete the document load request."
        title="Editor unavailable"
      >
        <EmptyState
          action={
            <Button onClick={() => window.location.reload()} variant="secondary">
              Retry load
            </Button>
          }
          description={loadError ?? 'An unexpected error interrupted the editor flow.'}
          eyebrow="Backend issue"
          title="The editor could not load this document"
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={document.title}
      subtitle="This editor is intentionally plain-text and contract-first: load, review permission state, edit if allowed, and save cleanly back to the existing backend."
      actions={
        <>
          <PermissionPill role={permission} />
          <Button onClick={handleSave} disabled={!canEdit || !isDirty || saveState === 'saving'}>
            {saveState === 'saving'
              ? 'Saving...'
              : canEdit
                ? isDirty
                  ? 'Save changes'
                  : 'Saved'
                : 'Read only'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {!canEdit ? (
            <StatusBanner title="This document is view-only for your current role." tone="warning">
              The frontend disables editing because the collaborator list indicates viewer access.
            </StatusBanner>
          ) : null}

          {saveState === 'saved' ? (
            <StatusBanner title="Changes saved successfully." tone="success">
              The current document state came back from `PUT /api/documents/:id`.
            </StatusBanner>
          ) : null}

          {saveState === 'error' && saveError ? (
            <StatusBanner title={saveError} tone="danger" />
          ) : null}

          <section className="shell-card-strong rounded-[32px] p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              <span>Document #{document.id}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Updated {formatRelativeTimestamp(document.updated_at)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{isDirty ? 'Unsaved local changes' : 'In sync with backend'}</span>
            </div>

            <div className="space-y-5">
              <InputField
                hint={canEdit ? 'This maps directly to the backend document title.' : 'View-only title field.'}
                label="Document title"
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setSaveState('idle');
                  setSaveError(null);
                }}
                readOnly={!canEdit}
                value={draftTitle}
              />

              <TextareaField
                className="min-h-[28rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,241,0.98))]"
                hint={
                  canEdit
                    ? 'Plain-text PoC editor. Rich text and realtime collaboration are deferred.'
                    : 'Viewer mode uses the same document content payload, rendered read-only.'
                }
                label="Document content"
                onChange={(event) => {
                  setDraftContent(event.target.value);
                  setSaveState('idle');
                  setSaveError(null);
                }}
                readOnly={!canEdit}
                value={draftContent}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="shell-card rounded-[32px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
              Collaborators
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight">Current access</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">
              This panel reflects the static collaborator payload returned by the backend today.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-950">Owner</p>
                <p className="text-sm text-emerald-800">
                  User #{document.owner_id}
                  {document.owner_id === user?.id ? ' (you)' : ''}
                </p>
              </div>

              {collaborators.length === 0 ? (
                <div className="rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-4 text-sm leading-6 text-[color:var(--text-soft)]">
                  No collaborator rows are currently attached to this document.
                </div>
              ) : (
                collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
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
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="shell-card rounded-[32px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
              PoC notes
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--text-soft)]">
              <li>Save is manual in this slice to keep the contract and demo flow obvious.</li>
              <li>Realtime presence, version history, sharing controls, and AI UI are deferred.</li>
              <li>The frontend intentionally mirrors backend role limits: owner, editor, viewer.</li>
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
