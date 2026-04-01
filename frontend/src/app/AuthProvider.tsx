import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../services/api';
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../services/storage';
import type { ApiUser, AuthResponse } from '../types/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: ApiUser | null;
  flashMessage: string | null;
  signIn: (response: AuthResponse) => void;
  signOut: (message?: string) => void;
  clearFlashMessage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<ApiUser | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setStatus('anonymous');
      return;
    }

    let alive = true;

    api.auth
      .me()
      .then((response) => {
        if (!alive) {
          return;
        }

        setUser(response.user);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (!alive) {
          return;
        }

        clearStoredToken();
        setUser(null);
        setStatus('anonymous');

        if (error instanceof ApiError && error.status === 401) {
          setFlashMessage('Your session expired. Sign in again to continue.');
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setUser(null);
      setStatus('anonymous');
      setFlashMessage(detail?.message ?? 'Your session expired. Sign in again to continue.');
    };

    window.addEventListener('app:unauthorized', handler as EventListener);
    return () => window.removeEventListener('app:unauthorized', handler as EventListener);
  }, []);

  const value: AuthContextValue = {
    status,
    user,
    flashMessage,
    signIn(response) {
      setStoredToken(response.token);
      setUser(response.user);
      setStatus('authenticated');
      setFlashMessage(null);
    },
    signOut(message) {
      clearStoredToken();
      setUser(null);
      setStatus('anonymous');
      setFlashMessage(message ?? null);
    },
    clearFlashMessage() {
      setFlashMessage(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
