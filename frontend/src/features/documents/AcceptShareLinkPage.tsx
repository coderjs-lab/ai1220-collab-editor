import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { StatusBanner } from '../../components/StatusBanner';
import { api, ApiError } from '../../services/api';

type AcceptState = 'loading' | 'success' | 'error';

export function AcceptShareLinkPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<AcceptState>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This share link is invalid.');
      return;
    }

    let alive = true;

    api.shareLinks
      .accept(token)
      .then((response) => {
        if (!alive) {
          return;
        }

        setState('success');
        setMessage(
          response.role === 'viewer'
            ? 'Access granted. Opening the shared draft in read-only mode.'
            : 'Access granted. Opening the shared draft.',
        );

        window.setTimeout(() => {
          navigate(`/documents/${response.document.id}`, { replace: true });
        }, 900);
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        setState('error');
        setMessage(
          error instanceof ApiError
            ? error.error
            : 'This share link could not be accepted right now.',
        );
      });

    return () => {
      alive = false;
    };
  }, [navigate, token]);

  if (state === 'loading') {
    return (
      <AppShell
        eyebrow="Share link"
        subtitle="Verifying access and attaching this document to your workspace."
        title="Opening shared document"
      >
        <EmptyState
          action={<Button disabled>Accepting link...</Button>}
          description="Draftboard is validating the link and preparing the shared workspace."
          eyebrow="Collaborator access"
          title="Joining the shared document"
        />
      </AppShell>
    );
  }

  if (state === 'success') {
    return (
      <AppShell
        eyebrow="Share link"
        subtitle="The document has been added to your workspace."
        title="Access granted"
      >
        <StatusBanner title={message ?? 'Opening the shared document.'} tone="success" />
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Share link"
      subtitle="This shared document could not be opened."
      title="Link unavailable"
    >
      <EmptyState
        action={
          <Link
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] px-4 py-2.5 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
            to="/documents"
          >
            Return to documents
          </Link>
        }
        description={message ?? 'This link may have expired, been revoked, or never existed.'}
        eyebrow="Unavailable"
        title="This share link is no longer valid"
      />
    </AppShell>
  );
}
