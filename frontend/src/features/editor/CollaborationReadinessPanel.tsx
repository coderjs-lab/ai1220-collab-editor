import { Button } from '../../components/Button';
import { StatusBanner } from '../../components/StatusBanner';
import type { CollaborationReadinessState } from './useCollaborationSession';

function formatExpiry(expiresIn: number | null) {
  if (expiresIn === null) {
    return null;
  }

  const minutes = Math.round(expiresIn / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function statusLabel(status: CollaborationReadinessState) {
  if (status === 'loading') {
    return 'Preparing';
  }

  if (status === 'ready') {
    return 'Ready';
  }

  if (status === 'comingSoon') {
    return 'Coming soon';
  }

  if (status === 'unavailable') {
    return 'Unavailable';
  }

  return 'Idle';
}

function statusClasses(status: CollaborationReadinessState) {
  if (status === 'loading') {
    return 'border-teal-200 bg-teal-50 text-teal-950';
  }

  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  }

  if (status === 'comingSoon') {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (status === 'unavailable') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-[color:var(--border)] bg-white/75 text-[color:var(--text-soft)]';
}

interface CollaborationReadinessPanelProps {
  status: CollaborationReadinessState;
  message: string | null;
  expiresIn: number | null;
  onRetry: () => void;
  embedded?: boolean;
}

export function CollaborationReadinessPanel({
  status,
  message,
  expiresIn,
  onRetry,
  embedded = false,
}: CollaborationReadinessPanelProps) {
  const expiryLabel = formatExpiry(expiresIn);
  const containerClassName = embedded ? '' : 'shell-card rounded-[32px] p-5';

  return (
    <section className={containerClassName}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
          Collaboration
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
          Session readiness
        </h2>
        <p className="text-sm leading-6 text-[color:var(--text-soft)]">
          The editor can verify whether this document is ready for a future live collaboration
          connection.
        </p>
      </div>

      <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[color:var(--text)]">Connection status</p>
          <span
            className={[
              'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
              statusClasses(status),
            ].join(' ')}
          >
            {statusLabel(status)}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {status === 'loading' ? (
            <StatusBanner title="Preparing collaboration access for this document." tone="info" />
          ) : null}

          {message ? (
            <StatusBanner
              title={message}
              tone={status === 'unavailable' ? 'danger' : status === 'comingSoon' ? 'warning' : 'success'}
            />
          ) : null}

          {expiryLabel ? (
            <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-4 py-3 text-sm leading-6 text-[color:var(--text-soft)]">
              If activated, this session would expire in {expiryLabel}.
            </div>
          ) : null}

          <div className="rounded-[20px] border border-[color:var(--border)] bg-white/75 px-4 py-4 text-sm leading-6 text-[color:var(--text-soft)]">
            This card only reports readiness from the backend session endpoint. It does not imply
            live collaborator presence, cursor sync, or real-time editing are active yet.
          </div>

          {status === 'unavailable' ? (
            <Button onClick={onRetry} variant="secondary">
              Retry session
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
