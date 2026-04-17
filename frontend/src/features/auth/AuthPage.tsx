import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../../components/Button';
import { InputField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import { api, ApiError } from '../../services/api';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  mode: AuthMode;
}

interface AuthFields {
  username: string;
  email: string;
  password: string;
}

interface AuthFieldErrors {
  username?: string;
  email?: string;
  password?: string;
}

const initialFields: AuthFields = {
  username: '',
  email: '',
  password: '',
};

function validate(fields: AuthFields, mode: AuthMode): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (mode === 'register') {
    if (!fields.username.trim()) {
      errors.username = 'Enter a username.';
    } else if (fields.username.trim().length < 1) {
      errors.username = 'Username must not be empty.';
    }
  }

  if (!fields.email.trim()) {
    errors.email = 'Enter an email address.';
  } else if (fields.email.trim().length < 3) {
    errors.email = 'Email must be at least 3 characters.';
  }

  if (!fields.password.trim()) {
    errors.password = 'Enter a password.';
  } else if (mode === 'register' && fields.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  return errors;
}

const featureCards = [
  {
    eyebrow: 'Focused',
    title: 'Write in a calm, distraction-light workspace.',
  },
  {
    eyebrow: 'Shared',
    title: 'Control who can view or edit each document.',
  },
  {
    eyebrow: 'Tracked',
    title: 'Keep a clear trail of saved revisions as work evolves.',
  },
] as const;

export function AuthPage({ mode }: AuthPageProps) {
  const [fields, setFields] = useState<AuthFields>(initialFields);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isRegister = mode === 'register';
  const redirectTarget =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof location.state.from === 'string'
      ? location.state.from
      : '/documents';

  const heading = isRegister ? 'Create your workspace' : 'Welcome back';
  const subheading = isRegister
    ? 'Start a shared writing space for notes, drafts, and collaborative edits.'
    : 'Pick up your documents, revisions, and shared work where you left off.';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(fields, mode);
    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    auth.clearFlashMessage();
    setIsSubmitting(true);

    try {
      const response = isRegister
        ? await api.auth.register({
            username: fields.username.trim(),
            email: fields.email.trim(),
            password: fields.password,
          })
        : await api.auth.login({
            email: fields.email.trim(),
            password: fields.password,
          });

      auth.signIn(response);
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.error);
      } else {
        setSubmitError('Could not reach Draftboard right now. Try again in a moment.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(field: keyof AuthFields, value: string) {
    auth.clearFlashMessage();
    setSubmitError(null);
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  return (
    <div className="editor-texture min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="animate-rise-in overflow-hidden rounded-[36px] border border-[color:var(--border)] bg-[linear-gradient(145deg,rgba(255,252,247,0.94),rgba(247,241,231,0.86))] p-6 shadow-[0_26px_80px_rgba(31,37,42,0.08)] sm:p-10">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--text-soft)]">
                Draftboard
              </p>
              <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight text-[color:var(--text)] sm:text-6xl">
                Collaborative writing built for clean handoffs.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-[color:var(--text-soft)]">
                Keep active drafts organized, share access intentionally, and stay close to the
                latest saved version of every document.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map((card) => (
                <article
                  key={card.eyebrow}
                  className="rounded-[28px] border border-[color:var(--border)] bg-white/80 p-4 shadow-[0_16px_40px_rgba(31,37,42,0.04)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                    {card.eyebrow}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--text-soft)]">
                    {card.title}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="animate-rise-in shell-card-strong rounded-[36px] px-6 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-lg space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--text-soft)]">
                {isRegister ? 'Create account' : 'Sign in'}
              </p>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-[color:var(--text)]">
                {heading}
              </h2>
              <p className="text-base leading-7 text-[color:var(--text-soft)]">{subheading}</p>
            </div>

            {auth.flashMessage ? (
              <StatusBanner title={auth.flashMessage} tone="warning" />
            ) : null}

            {submitError ? <StatusBanner title={submitError} tone="danger" /> : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isRegister ? (
                <InputField
                  autoComplete="username"
                  error={errors.username ?? null}
                  label="Username"
                  name="username"
                  onChange={(event) => updateField('username', event.target.value)}
                  placeholder="harman"
                  value={fields.username}
                />
              ) : null}

              <InputField
                autoComplete="email"
                error={errors.email ?? null}
                label="Email"
                name="email"
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={fields.email}
              />

              <InputField
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                error={errors.password ?? null}
                label="Password"
                name="password"
                onChange={(event) => updateField('password', event.target.value)}
                placeholder={isRegister ? 'Create a password' : 'Enter your password'}
                type="password"
                value={fields.password}
              />

              <Button block disabled={isSubmitting} type="submit">
                {isSubmitting
                  ? isRegister
                    ? 'Creating account...'
                    : 'Signing in...'
                  : isRegister
                    ? 'Create account'
                    : 'Sign in'}
              </Button>
            </form>

            <p className="text-sm leading-6 text-[color:var(--text-soft)]">
              {isRegister ? 'Already have an account?' : 'Need an account first?'}{' '}
              <Link
                className="font-semibold text-teal-800 underline decoration-teal-300 underline-offset-4"
                to={isRegister ? '/login' : '/register'}
              >
                {isRegister ? 'Sign in' : 'Create one'}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
