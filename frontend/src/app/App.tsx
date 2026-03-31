import type { ReactElement } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthProvider';
import { AuthPage } from '../features/auth/AuthPage';
import { DocumentsPage } from '../features/documents/DocumentsPage';
import { EditorPage } from '../features/editor/EditorPage';
import { EmptyState } from '../components/EmptyState';

function FullScreenLoader() {
  return (
    <div className="editor-texture flex min-h-screen items-center justify-center px-4">
      <div className="shell-card status-glow w-full max-w-md rounded-[32px] px-8 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
          Session restore
        </p>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-[color:var(--text)]">
          Waking up your workspace
        </h1>
        <p className="mt-3 text-base leading-7 text-[color:var(--text-soft)]">
          Checking your saved session and reconnecting the editor shell.
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
  const location = useLocation();

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <EmptyState
          eyebrow="Unknown route"
          title="This page is outside the current PoC surface."
          description={`No route is implemented for ${location.pathname}. Use /login, /register, /documents, or /documents/:id.`}
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
