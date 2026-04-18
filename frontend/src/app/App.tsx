import type { ReactElement } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthProvider';
import { EmptyState } from '../components/EmptyState';
import { AuthPage } from '../features/auth/AuthPage';
import { AcceptShareLinkPage } from '../features/documents/AcceptShareLinkPage';
import { DocumentsPage } from '../features/documents/DocumentsPage';
import { EditorPage } from '../features/editor/EditorPage';

function FullScreenLoader() {
  return (
    <div className="editor-texture flex min-h-screen items-center justify-center px-4">
      <div className="shell-card status-glow w-full max-w-md rounded-[32px] px-8 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
          Restoring session
        </p>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-[color:var(--text)]">
          Reopening your workspace
        </h1>
        <p className="mt-3 text-base leading-7 text-[color:var(--text-soft)]">
          Checking your saved access and loading the latest workspace state.
        </p>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  return <Navigate replace to={status === 'authenticated' ? '/documents' : '/login'} />;
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'authenticated') {
    return <Navigate replace to="/documents" />;
  }

  return children;
}

function NotFoundPage() {
  const { status } = useAuth();
  const location = useLocation();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <EmptyState
          action={
            <Link
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] px-4 py-2.5 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
              to={status === 'authenticated' ? '/documents' : '/login'}
            >
              {status === 'authenticated' ? 'Return to documents' : 'Back to sign in'}
            </Link>
          }
          description={`The page at ${location.pathname} is not available.`}
          eyebrow="Not found"
          title="This view does not exist"
        />
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <AuthPage mode="login" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <AuthPage mode="register" />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/:id"
        element={
          <ProtectedRoute>
            <EditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/share/:token"
        element={
          <ProtectedRoute>
            <AcceptShareLinkPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
