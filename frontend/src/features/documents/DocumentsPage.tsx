import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InputField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import { api, ApiError } from '../../services/api';
import { excerptText, formatRelativeTimestamp } from '../../utils/format';
import type { ApiDocument } from '../../types/api';
import { useAuth } from '../../app/AuthProvider';

function DocumentSection({
  title,
  description,
  documents,
  emptyDescription,
}: {
  title: string;
  description: string;
  documents: ApiDocument[];
  emptyDescription: string;
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
          <p className="text-sm leading-6 text-[color:var(--text-soft)]">{emptyDescription}</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {documents.map((document) => (
            <Link
              key={document.id}
              className="shell-card group rounded-[28px] px-5 py-5 transition hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:bg-white"
              to={`/documents/${document.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-display text-2xl font-semibold tracking-tight text-[color:var(--text)]">
                    {document.title}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--text-soft)]">
                    {excerptText(document.content)}
                  </p>
                </div>
                <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                  Open
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                <span>Updated {formatRelativeTimestamp(document.updated_at)}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>Doc #{document.id}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

        setDocuments(response.documents);
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
            : 'Could not load documents. Check that the backend is running.',
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

  const ownedDocuments = documents.filter((document) => document.owner_id === user?.id);
  const sharedDocuments = documents.filter((document) => document.owner_id !== user?.id);

  return (
    <AppShell
      title="Document workspace"
      subtitle="Use the implemented backend flow to create a document, reopen existing work, and step into the editor shell without inventing unsupported features."
      actions={
        <form
          className="shell-card rounded-[28px] p-2 sm:min-w-[25rem]"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1">
              <InputField
                className="border-transparent bg-transparent px-3 py-2 focus:border-[color:var(--border-strong)]"
                hint="Leave blank to use the backend default title of Untitled."
                label="New document title"
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Q2 launch notes"
                value={newTitle}
              />
            </div>
            <div className="flex items-end">
              <Button disabled={isCreating} type="submit">
                {isCreating ? 'Creating...' : 'Create document'}
              </Button>
            </div>
          </div>
        </form>
      }
    >
      <div className="space-y-6">
        {createError ? (
          <StatusBanner title={createError} tone="danger">
            The create flow uses POST /api/documents with an optional title only.
          </StatusBanner>
        ) : null}

        {isLoading ? (
          <EmptyState
            action={<Button disabled>Loading documents...</Button>}
            description="Fetching the current user's owned and shared documents from `GET /api/documents`."
            eyebrow="Loading"
            title="Preparing your document index"
          />
        ) : loadError ? (
          <EmptyState
            action={
              <Button onClick={() => window.location.reload()} variant="secondary">
                Retry load
              </Button>
            }
            description={loadError}
            eyebrow="Backend issue"
            title="The document list could not be loaded"
          />
        ) : documents.length === 0 ? (
          <EmptyState
            action={<Button onClick={handleCreate}>Create your first document</Button>}
            description="No documents are available yet. Create one to demonstrate the frontend-to-backend editing flow."
            eyebrow="Empty workspace"
            title="You do not have any documents yet"
          />
        ) : (
          <div className="space-y-8">
            <DocumentSection
              description="Documents where the current user is the owner according to `owner_id`."
              documents={ownedDocuments}
              emptyDescription="You do not own any documents yet."
              title="Owned by you"
            />
            <DocumentSection
              description="Documents returned by the backend because another owner shared access with you."
              documents={sharedDocuments}
              emptyDescription="Nothing has been shared with this account yet."
              title="Shared with you"
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
