import type { ReactNode } from 'react';

type StatusTone = 'info' | 'success' | 'warning' | 'danger';

interface StatusBannerProps {
  tone?: StatusTone;
  title: string;
  children?: ReactNode;
}

const toneClasses: Record<StatusTone, string> = {
  info: 'border-teal-200 bg-teal-50 text-teal-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-[color:var(--warn-soft)] text-[color:var(--warn)]',
  danger: 'border-red-200 bg-[color:var(--danger-soft)] text-[color:var(--danger)]',
};

export function StatusBanner({
  tone = 'info',
  title,
  children,
}: StatusBannerProps) {
  return (
    <div className={['rounded-[28px] border px-4 py-3', toneClasses[tone]].join(' ')}>
      <p className="text-sm font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm opacity-90">{children}</div> : null}
    </div>
  );
}
