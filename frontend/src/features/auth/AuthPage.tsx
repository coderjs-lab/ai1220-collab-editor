import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { InputField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import { useAuth } from '../../app/AuthProvider';
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

  if (mode === 'register' && !fields.username.trim()) {
    errors.username = 'Enter a username.';
  }

  if (!fields.email.trim()) {
    errors.email = 'Enter an email address.';
  }

  if (!fields.password.trim()) {
    errors.password = 'Enter a password.';
  }

  return errors;
}

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

  const heading = isRegister
    ? 'Create your workspace account'
    : 'Return to your shared writing desk';

  const subheading = isRegister
    ? 'Register with the existing backend contract, then land directly in the frontend PoC shell.'
    : 'Sign in with your backend account to load the document dashboard and editor flow.';

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
        setSubmitError('Could not reach the backend. Check that the API is running.');
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
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="animate-rise-in shell-card rounded-[36px] px-6 py-8 sm:px-10 sm:py-10">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--text-soft)]">
                Collaborative editor frontend
              </p>
              <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight text-[color:var(--text)] sm:text-6xl">
                Buildable, report-aligned collaboration.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-[color:var(--text-soft)]">
                This first slice keeps the experience narrow on purpose: authentication, document
                navigation, and one clean editor save flow against the existing backend.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-[28px] border border-[color:var(--border)] bg-white/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                  Contract-first
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">
                  Uses the backend routes and field names exactly as implemented.
                </p>
              </article>
              <article className="rounded-[28px] border border-[color:var(--border)] bg-white/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                  Permission aware
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">
                  Viewer access stays readable and explicit instead of breaking the editor.
                </p>
              </article>
              <article className="rounded-[28px] border border-[color:var(--border)] bg-white/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                  Demo ready
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">
                  Narrow enough to run live during the course submission demo.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="animate-rise-in shell-card-strong rounded-[36px] px-6 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-lg space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--text-soft)]">
                {isRegister ? 'Register' : 'Login'}
              </p>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-[color:var(--text)]">
                {heading}
              </h2>
              <p className="text-base leading-7 text-[color:var(--text-soft)]">{subheading}</p>
            </div>

            {auth.flashMessage ? (
              <StatusBanner title={auth.flashMessage} tone="warning" />
            ) : null}

            {submitError ? (
              <StatusBanner title={submitError} tone="danger">
                The message is coming directly from the backend error response where available.
              </StatusBanner>
            ) : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isRegister ? (
                <InputField
                  autoComplete="username"
                  error={errors.username ?? null}
                  label="Username"
                  name="username"
                  onChange={(event) => updateField('username', event.target.value)}
                  placeholder="e.g. harman"
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
                {isRegister ? 'Sign in here' : 'Register here'}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
