import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  children: ReactNode;
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    'bg-teal-700 text-white shadow-[0_14px_30px_rgba(15,118,110,0.2)] hover:bg-teal-800 focus-visible:outline-teal-700',
  secondary:
    'border border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] text-teal-900 hover:bg-teal-100 focus-visible:outline-teal-700',
  ghost:
    'border border-[color:var(--border)] bg-white/70 text-[color:var(--text)] hover:bg-white focus-visible:outline-slate-500',
  danger:
    'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:outline-red-500',
};

export function Button({
  variant = 'primary',
  block = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        block ? 'w-full' : '',
        variantClassNames[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
