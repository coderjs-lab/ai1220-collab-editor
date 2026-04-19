import { useEffect, useState } from 'react';
import { api, ApiError } from '../../services/api';
import type { DocumentSessionResponse } from '../../types/api';

export type CollaborationSessionState = 'idle' | 'loading' | 'ready' | 'unavailable';

export function useCollaborationSession(documentId: string | null) {
  const [status, setStatus] = useState<CollaborationSessionState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState<DocumentSessionResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!documentId) {
      setStatus('idle');
      setMessage(null);
      setSession(null);
      return;
    }

    let alive = true;

    setStatus('loading');
    setMessage(null);

    api.sessions
      .create(documentId)
      .then((response) => {
        if (!alive) {
          return;
        }

        setSession(response);
        setStatus('ready');
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        setSession(null);
        setStatus('unavailable');
        if (error instanceof ApiError && error.status === 401) {
          setMessage('Your session expired. Please sign in again.');
          return;
        }

        setMessage(
          error instanceof ApiError
            ? error.error
            : 'Could not prepare a collaboration session for this document.',
        );
      });

    return () => {
      alive = false;
    };
  }, [documentId, reloadKey]);

  function retry() {
    setReloadKey((current) => current + 1);
  }

  return {
    status,
    message,
    session,
    retry,
  };
}
