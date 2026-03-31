import type { ReactNode } from 'react';

interface EmptyStateProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ eyebrow, title, description, action }: EmptyStateProps) {
  return (
    <div className="shell-card rounded-[32px] px-6 py-10 text-center sm:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
        {eyebrow}
      </p>
      <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[color:var(--text-soft)]">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
