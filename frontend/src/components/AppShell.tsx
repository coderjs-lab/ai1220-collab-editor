import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { Button } from './Button';

interface AppShellProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="shell-card animate-rise-in rounded-[32px] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Link
                  to="/documents"
                  className="font-display text-2xl font-semibold tracking-tight text-[color:var(--text)]"
                >
                  Draftboard
                </Link>
                <span className="rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
                  PoC
                </span>
              </div>
              <nav className="flex flex-wrap gap-2 text-sm">
                <NavLink
                  to="/documents"
                  className={({ isActive }) =>
                    [
                      'rounded-full px-3 py-1.5 transition',
                      isActive
                        ? 'bg-teal-900 text-white'
                        : 'text-[color:var(--text-soft)] hover:bg-white/80 hover:text-[color:var(--text)]',
                    ].join(' ')
                  }
                >
                  Documents
                </NavLink>
              </nav>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-2 text-sm">
                <p className="font-semibold text-[color:var(--text)]">{user?.username}</p>
                <p className="text-[color:var(--text-soft)]">{user?.email}</p>
              </div>
              <Button variant="ghost" onClick={() => signOut('You signed out of the editor.')}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <section className="animate-rise-in flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
              Harman frontend slice
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-[color:var(--text)] sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[color:var(--text-soft)]">
              {subtitle}
            </p>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
        </section>

        <main className="animate-rise-in">{children}</main>
      </div>
    </div>
  );
}
