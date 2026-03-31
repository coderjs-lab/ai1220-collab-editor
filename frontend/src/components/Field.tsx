import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldBaseProps {
  label: string;
  hint?: string;
  error?: string | null;
}

interface InputFieldProps extends FieldBaseProps, InputHTMLAttributes<HTMLInputElement> {}
interface TextareaFieldProps
  extends FieldBaseProps,
    TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function InputField({ label, hint, error, className = '', ...props }: InputFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-[color:var(--text)]">
      <span className="font-semibold">{label}</span>
      <input
        className={[
          'w-full rounded-3xl border border-[color:var(--border)] bg-white/90 px-4 py-3 text-base outline-none transition',
          'focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-teal-100',
          error ? 'border-red-300 bg-red-50/80 focus:ring-red-100' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? (
        <span className="text-sm text-red-700">{error}</span>
      ) : hint ? (
        <span className="text-sm text-[color:var(--text-soft)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  className = '',
  ...props
}: TextareaFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-[color:var(--text)]">
      <span className="font-semibold">{label}</span>
      <textarea
        className={[
          'min-h-[260px] w-full rounded-[28px] border border-[color:var(--border)] bg-white/90 px-4 py-3 text-base outline-none transition',
          'focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-teal-100',
          error ? 'border-red-300 bg-red-50/80 focus:ring-red-100' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? (
        <span className="text-sm text-red-700">{error}</span>
      ) : hint ? (
        <span className="text-sm text-[color:var(--text-soft)]">{hint}</span>
      ) : null}
    </label>
  );
}
