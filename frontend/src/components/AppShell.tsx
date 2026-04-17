import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { Button } from './Button';

interface AppShellProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  eyebrow = 'Workspace',
  title,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="shell-card animate-rise-in rounded-[32px] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <Link
                  className="flex items-center gap-3 text-[color:var(--text)]"
                  to="/documents"
                >
                  <span className="brand-badge">D</span>
                  <div>
                    <p className="font-display text-2xl font-semibold tracking-tight">Draftboard</p>
                    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-soft)]">
                      Collaborative writing
                    </p>
                  </div>
                </Link>
              </div>

              <nav className="flex flex-wrap gap-2 text-sm">
                <NavLink
                  to="/documents"
                  className={({ isActive }) =>
                    [
                      'rounded-full px-3 py-1.5 font-semibold transform-gpu transition duration-150 ease-out',
                      'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985]',
                      isActive
                        ? 'bg-teal-900 !text-white shadow-[0_10px_24px_rgba(15,118,110,0.18)] hover:!text-white hover:shadow-[0_14px_28px_rgba(15,118,110,0.22)]'
                        : 'text-[color:var(--text-soft)] hover:bg-white/80 hover:text-[color:var(--text)] hover:shadow-[0_12px_24px_rgba(31,37,42,0.08)]',
                    ].join(' ')
                  }
                >
                  Documents
                </NavLink>
              </nav>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-2 text-sm shadow-[0_12px_24px_rgba(31,37,42,0.05)]">
                <p className="font-semibold text-[color:var(--text)]">{user?.username}</p>
                <p className="text-[color:var(--text-soft)]">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  void signOut('You signed out of Draftboard.');
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <section className="animate-rise-in flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
              {eyebrow}
            </p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-[color:var(--text)] sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[color:var(--text-soft)]">
              {subtitle}
            </p>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </section>

        <main className="animate-rise-in">{children}</main>
      </div>
    </div>
  );
}
