import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import { api, ApiError } from '../../services/api';
import type { ApiDocument } from '../../types/api';
import { excerptText, formatCount, formatRelativeTimestamp } from '../../utils/format';

function DashboardMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="shell-card flex min-h-[10.5rem] flex-col justify-between rounded-[28px] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
        {label}
      </p>
      <p className="font-display mt-4 text-5xl leading-none font-semibold tracking-tight text-[color:var(--text)] sm:text-[3.75rem]">
        {value}
      </p>
    </article>
  );
}

function DocumentCard({
  document,
  ownershipLabel,
  collaboratorCount,
  isOwner,
  isConfirmingDelete,
  isDeleting,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}: {
  document: ApiDocument;
  ownershipLabel: string;
  collaboratorCount?: number;
  isOwner: boolean;
  isConfirmingDelete: boolean;
  isDeleting: boolean;
  onDeleteClick: (documentId: number) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (documentId: number) => void;
}) {
  return (
    <article className="shell-card group flex h-full flex-col rounded-[28px] p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:bg-white">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              {ownershipLabel}
            </span>
            {collaboratorCount !== undefined ? (
              <span className="rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                {formatCount(collaboratorCount, 'collaborator')}
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <Link className="block" to={`/documents/${document.id}`}>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-[color:var(--text)]">
                {document.title}
              </h2>
            </Link>
            <p className="text-sm leading-6 text-[color:var(--text-soft)]">
              {excerptText(document.content, 150)}
            </p>
          </div>
        </div>

        <Link
          className="rounded-full border border-[color:var(--border)] bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
          to={`/documents/${document.id}`}
        >
          Open
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
        <span>Updated {formatRelativeTimestamp(document.updated_at)}</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span>Doc #{document.id}</span>
      </div>

      {isOwner ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-4">
          {isConfirmingDelete ? (
            <>
              <span className="text-sm text-[color:var(--text-soft)]">
                Delete this document?
              </span>
              <Button
                disabled={isDeleting}
                onClick={() => onConfirmDelete(document.id)}
                variant="danger"
              >
                {isDeleting ? 'Deleting...' : 'Confirm delete'}
              </Button>
              <Button disabled={isDeleting} onClick={onCancelDelete} variant="ghost">
                Cancel
              </Button>
            </>
          ) : (
            <Button
              disabled={isDeleting}
              onClick={() => onDeleteClick(document.id)}
              variant="ghost"
            >
              Delete
            </Button>
          )}
        </div>
      ) : null}
    </article>
  );
}

function DocumentSection({
  title,
  description,
  documents,
  ownershipLabel,
  collaboratorCounts,
  deleteState,
  onDeleteClick,
  onCancelDelete,
  onConfirmDelete,
}: {
  title: string;
  description: string;
  documents: ApiDocument[];
  ownershipLabel: string;
  collaboratorCounts: Record<number, number>;
  deleteState: {
    confirmDeleteId: number | null;
    deletingId: number | null;
  };
  onDeleteClick: (documentId: number) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (documentId: number) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
            {title}
          </h2>
          <p className="text-sm leading-6 text-[color:var(--text-soft)]">{description}</p>
        </div>
        <span className="rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
          {documents.length} {documents.length === 1 ? 'document' : 'documents'}
        </span>
      </div>

      {documents.length === 0 ? (
        <div className="shell-card rounded-[28px] px-5 py-6">
          <p className="text-sm leading-6 text-[color:var(--text-soft)]">
            Nothing to show here yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              collaboratorCount={collaboratorCounts[document.id]}
              document={document}
              isConfirmingDelete={deleteState.confirmDeleteId === document.id}
              isDeleting={deleteState.deletingId === document.id}
              isOwner={ownershipLabel === 'Owned'}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={onConfirmDelete}
              onDeleteClick={onDeleteClick}
              ownershipLabel={ownershipLabel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [collaboratorCounts, setCollaboratorCounts] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;

    api.documents
      .list()
      .then((response) => {
        if (!alive) {
          return;
        }

        const sortedDocuments = [...response.documents].sort(
          (left, right) =>
            new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
        );

        setDocuments(sortedDocuments);
        setLoadError(null);
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          return;
        }

        setLoadError(
          error instanceof ApiError
            ? error.error
            : 'Could not load your documents right now.',
        );
      })
      .finally(() => {
        if (alive) {
          setIsLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (documents.length === 0) {
      setCollaboratorCounts({});
      return;
    }

    let alive = true;

    void Promise.all(
      documents.map(async (document) => {
        const response = await api.documents.get(String(document.id));
        return [document.id, response.collaborators.length] as const;
      }),
    )
      .then((entries) => {
        if (!alive) {
          return;
        }

        setCollaboratorCounts(
          Object.fromEntries(entries.map(([documentId, count]) => [documentId, count])),
        );
      })
      .catch(() => {
        if (alive) {
          setCollaboratorCounts({});
        }
      });

    return () => {
      alive = false;
    };
  }, [documents]);

  async function handleCreate() {
    setCreateError(null);
    setIsCreating(true);

    try {
      const response = await api.documents.create({
        title: newTitle.trim() || undefined,
      });
      navigate(`/documents/${response.document.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setCreateError(error.error);
      } else {
        setCreateError('Could not create a new document.');
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(documentId: number) {
    const snapshot = documents;

    setDeleteError(null);
    setDeletingId(documentId);
    setDocuments((current) => current.filter((document) => document.id !== documentId));

    try {
      await api.documents.remove(String(documentId));
      setCollaboratorCounts((current) => {
        const next = { ...current };
        delete next[documentId];
        return next;
      });
      setConfirmDeleteId(null);
    } catch (error) {
      setDocuments(snapshot);
      if (error instanceof ApiError) {
        setDeleteError(error.error);
      } else {
        setDeleteError('Could not delete that document.');
      }
    } finally {
      setDeletingId(null);
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleDocuments = documents.filter((document) => {
    if (!normalizedQuery) {
      return true;
    }

    return [document.title, document.content]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const ownedDocuments = visibleDocuments.filter((document) => document.owner_id === user?.id);
  const sharedDocuments = visibleDocuments.filter((document) => document.owner_id !== user?.id);

  return (
    <AppShell
      eyebrow="Workspace"
      subtitle="Start something new, revisit recent drafts, or jump back into documents shared with you."
      title="Your documents"
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="shell-card-strong rounded-[32px] p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                  Quick start
                </p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
                  Start a fresh draft
                </h2>
                <p className="text-sm leading-6 text-[color:var(--text-soft)]">
                  Create a document in one step, then refine the title and content inside the
                  editor.
                </p>
              </div>

              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreate();
                }}
              >
                <div className="min-w-0 flex-1">
                  <InputField
                    hint="Leave blank to begin with Untitled."
                    label="Document title"
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="Q2 launch notes"
                    value={newTitle}
                  />
                </div>
                <Button disabled={isCreating} type="submit">
                  {isCreating ? 'Creating...' : 'Create document'}
                </Button>
              </form>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <DashboardMetric label="Total" value={String(documents.length)} />
            <DashboardMetric
              label="Owned"
              value={String(documents.filter((document) => document.owner_id === user?.id).length)}
            />
            <DashboardMetric
              label="Shared"
              value={String(documents.filter((document) => document.owner_id !== user?.id).length)}
            />
          </section>
        </div>

        <section className="shell-card rounded-[32px] p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                Find work fast
              </p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
                Search across your workspace
              </h2>
            </div>
            <div className="w-full max-w-xl">
              <InputField
                label="Search"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search titles or content"
                value={searchQuery}
              />
            </div>
          </div>
        </section>

        {createError ? <StatusBanner title={createError} tone="danger" /> : null}
        {deleteError ? <StatusBanner title={deleteError} tone="danger" /> : null}

        {isLoading ? (
          <EmptyState
            action={<Button disabled>Loading documents...</Button>}
            description="Bringing your latest drafts and shared work into view."
            eyebrow="Loading"
            title="Preparing your workspace"
          />
        ) : loadError ? (
          <EmptyState
            action={
              <Button onClick={() => window.location.reload()} variant="secondary">
                Retry load
              </Button>
            }
            description={loadError}
            eyebrow="Unavailable"
            title="Your document library could not be loaded"
          />
        ) : documents.length === 0 ? (
          <EmptyState
            action={<Button onClick={() => void handleCreate()}>Create your first document</Button>}
            description="Start with a blank draft and build your workspace from there."
            eyebrow="Empty workspace"
            title="No documents yet"
          />
        ) : visibleDocuments.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={() => setSearchQuery('')} variant="secondary">
                Clear search
              </Button>
            }
            description="Try a different title or content phrase."
            eyebrow="No matches"
            title="Nothing matches this search"
          />
        ) : (
          <div className="space-y-8">
            <DocumentSection
              collaboratorCounts={collaboratorCounts}
              deleteState={{ confirmDeleteId, deletingId }}
              description="Documents you own and can manage directly."
              documents={ownedDocuments}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={(documentId) => void handleDelete(documentId)}
              onDeleteClick={(documentId) => setConfirmDeleteId(documentId)}
              ownershipLabel="Owned"
              title="Owned by you"
            />

            <DocumentSection
              collaboratorCounts={collaboratorCounts}
              deleteState={{ confirmDeleteId, deletingId }}
              description="Documents another workspace member has shared with you."
              documents={sharedDocuments}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={(documentId) => void handleDelete(documentId)}
              onDeleteClick={(documentId) => setConfirmDeleteId(documentId)}
              ownershipLabel="Shared"
              title="Shared with you"
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
