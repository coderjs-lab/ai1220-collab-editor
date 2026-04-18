import { Button } from '../../components/Button';
import { StatusBanner } from '../../components/StatusBanner';
import type { CollabConnectionState, PresenceUser } from './useCollaborativeEditor';

function stateTone(state: CollabConnectionState) {
  if (state === 'connected' || state === 'resynced') {
    return 'success';
  }
  if (state === 'error') {
    return 'danger';
  }
  if (state === 'reconnecting' || state === 'offline') {
    return 'warning';
  }
  return 'info';
}

function stateLabel(state: CollabConnectionState) {
  if (state === 'connected') {
    return 'Connected';
  }
  if (state === 'resynced') {
    return 'Resynced';
  }
  if (state === 'connecting') {
    return 'Connecting';
  }
  if (state === 'reconnecting') {
    return 'Reconnecting';
  }
  if (state === 'offline') {
    return 'Offline';
  }
  if (state === 'error') {
    return 'Error';
  }
  return 'Idle';
}

function stateAccent(state: CollabConnectionState) {
  if (state === 'connected' || state === 'resynced') {
    return 'bg-emerald-500';
  }
  if (state === 'reconnecting' || state === 'connecting') {
    return 'bg-amber-500';
  }
  if (state === 'error') {
    return 'bg-rose-500';
  }
  return 'bg-slate-400';
}

function roleLabel(role: PresenceUser['role']) {
  if (role === 'owner') {
    return 'Owner';
  }
  if (role === 'editor') {
    return 'Editor';
  }
  if (role === 'viewer') {
    return 'Viewer';
  }
  return 'Guest';
}

interface CollaborationPanelProps {
  state: CollabConnectionState;
  message: string | null;
  presenceUsers: PresenceUser[];
  onRetrySession: () => void;
  embedded?: boolean;
}

export function CollaborationPanel({
  state,
  message,
  presenceUsers,
  onRetrySession,
  embedded = false,
}: CollaborationPanelProps) {
  const containerClassName = embedded ? '' : 'shell-card rounded-[32px] p-5';

  return (
    <section className={containerClassName}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
          Collaboration
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
          Live session
        </h2>
        <p className="text-sm leading-6 text-[color:var(--text-soft)]">
          Shared editing, presence, reconnect handling, and remote carets are managed through the
          active collaboration channel.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[color:var(--text)]">Connection</p>
            <span
              className={`h-2.5 w-2.5 rounded-full ${stateAccent(state)} ${
                state === 'connecting' || state === 'reconnecting' ? 'animate-pulse' : ''
              }`}
            />
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--text)]">
            {stateLabel(state)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">
            {message ?? 'The shared editor session is healthy.'}
          </p>
        </div>

        <div className="rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
          <p className="text-sm font-semibold text-[color:var(--text)]">Present now</p>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--text)]">
            {presenceUsers.length}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">
            Unique active collaborators in the current session.
          </p>
        </div>
      </div>

      {message ? (
        <div className="mt-4">
          <StatusBanner title={message} tone={stateTone(state)} />
        </div>
      ) : null}

      {state !== 'connected' && state !== 'resynced' ? (
        <div className="mt-4">
          <Button onClick={onRetrySession} variant="secondary">
            Retry collaboration
          </Button>
        </div>
      ) : null}

      <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
        <div className="flex flex-wrap gap-2">
          {presenceUsers.length === 0 ? (
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-3 py-2 text-sm text-[color:var(--text-soft)]">
              No active collaborators visible right now.
            </span>
          ) : (
            presenceUsers.map((user) => (
              <span
                key={`${user.userId ?? user.name}-${user.role}`}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-3 py-2 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                <span className="font-semibold text-[color:var(--text)]">{user.name}</span>
                <span className="text-[color:var(--text-soft)]">{roleLabel(user.role)}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[color:var(--text)]">Active collaborators</p>
          <p className="text-sm leading-6 text-[color:var(--text-soft)]">
            Everyone currently connected to this shared document session.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {presenceUsers.length === 0 ? (
            <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--text-soft)]">
              No active collaborators visible right now.
            </div>
          ) : (
            presenceUsers.map((user) => (
              <div
                key={`${user.userId ?? user.name}-${user.role}`}
                className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: user.color }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)]">{user.name}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                      {roleLabel(user.role)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.connections > 1 ? (
                    <span className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                      {user.connections} tabs
                    </span>
                  ) : null}
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                    online
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
