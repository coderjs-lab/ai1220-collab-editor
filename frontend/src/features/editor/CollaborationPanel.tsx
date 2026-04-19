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

function stateSummary(state: CollabConnectionState) {
  if (state === 'connected' || state === 'resynced') {
    return 'Shared session';
  }
  if (state === 'connecting') {
    return 'Joining room';
  }
  if (state === 'reconnecting') {
    return 'Recovering sync';
  }
  if (state === 'offline') {
    return 'Retrying later';
  }
  if (state === 'error') {
    return 'Needs attention';
  }
  return 'Waiting';
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

function activityLabel(activity: PresenceUser['activity']) {
  if (activity === 'typing') {
    return 'typing';
  }
  if (activity === 'active') {
    return 'active';
  }
  return 'idle';
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
  const containerClassName = embedded ? 'min-w-0' : 'shell-card min-w-0 rounded-[32px] p-5';
  const statsGridClassName = embedded
    ? 'mt-4 grid grid-cols-3 gap-2'
    : 'mt-5 grid gap-3 sm:grid-cols-3';
  const typingUsers = presenceUsers.filter((user) => user.activity === 'typing');

  return (
    <section className={containerClassName}>
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
          Collaboration
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
          Live session
        </h2>
        <p className="break-words text-sm leading-6 text-[color:var(--text-soft)]">
          {embedded
            ? 'Shared editing, presence, and reconnect status.'
            : 'Shared editing, presence, reconnect handling, and remote carets are managed through the active collaboration channel.'}
        </p>
      </div>

      <div className={statsGridClassName}>
        <div className="min-w-0 rounded-[20px] border border-[color:var(--border)] bg-white/80 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-[color:var(--text-soft)]">
              Sync
            </p>
            <span
              className={`mt-px h-2 w-2 shrink-0 rounded-full ${stateAccent(state)} ${
                state === 'connecting' || state === 'reconnecting' ? 'animate-pulse' : ''
              }`}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p
              className={[
                'min-w-0 break-words font-semibold text-[color:var(--text)]',
                embedded ? 'text-[0.76rem] leading-5' : 'text-sm',
              ].join(' ')}
            >
              {stateLabel(state)}
            </p>
          </div>
          {!embedded ? (
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
              {stateSummary(state)}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 rounded-[20px] border border-[color:var(--border)] bg-white/80 px-3 py-3">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-[color:var(--text-soft)]">
            Present
          </p>
          <p className="mt-2 text-[1.12rem] font-semibold leading-none tracking-tight text-[color:var(--text)]">
            {presenceUsers.length}
          </p>
          <p className="mt-1 text-[0.62rem] font-medium uppercase tracking-[0.13em] text-[color:var(--text-soft)]">
            Online
          </p>
        </div>

        <div className="min-w-0 rounded-[20px] border border-[color:var(--border)] bg-white/80 px-3 py-3">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-[color:var(--text-soft)]">
            Typing
          </p>
          <p className="mt-2 text-[1.12rem] font-semibold leading-none tracking-tight text-[color:var(--text)]">
            {typingUsers.length}
          </p>
          <p className="mt-1 text-[0.62rem] font-medium uppercase tracking-[0.13em] text-[color:var(--text-soft)]">
            Active now
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

      <div className="mt-4 min-w-0 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-[color:var(--text)]">Active collaborators</p>
          {!embedded ? (
            <p className="break-words text-sm leading-6 text-[color:var(--text-soft)]">
              Everyone currently connected to this shared document session.
            </p>
          ) : null}
        </div>

        <div className="mt-3 space-y-2.5">
          {presenceUsers.length === 0 ? (
            <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-3 py-3 text-sm leading-6 text-[color:var(--text-soft)]">
              No active collaborators visible right now.
            </div>
          ) : (
            presenceUsers.map((user) => (
              <div
                key={`${user.userId ?? user.name}-${user.role}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--bg-strong)] px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: user.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--text)]">{user.name}</p>
                    <p className="break-words text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      {roleLabel(user.role)} · {activityLabel(user.activity)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {user.connections > 1 ? (
                    <span className="rounded-full border border-[color:var(--border)] bg-white px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                      {user.connections}x
                    </span>
                  ) : null}
                  <span
                    className={[
                      'rounded-full border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em]',
                      user.activity === 'typing'
                        ? 'border-violet-200 bg-violet-50 text-violet-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900',
                    ].join(' ')}
                  >
                    {user.activity === 'typing' ? 'typing' : 'online'}
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
