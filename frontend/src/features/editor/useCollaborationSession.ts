import { useEffect, useState } from 'react';
import { api, ApiError } from '../../services/api';

export type CollaborationReadinessState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'comingSoon'
  | 'unavailable';

const STUB_SESSION_TOKEN = '[stub] collab-server not yet implemented';

export function useCollaborationSession(documentId: string | null) {
  const [status, setStatus] = useState<CollaborationReadinessState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!documentId) {
      setStatus('idle');
      setMessage(null);
      setExpiresIn(null);
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

        setExpiresIn(response.expiresIn);

        if (response.sessionToken === STUB_SESSION_TOKEN) {
          setStatus('comingSoon');
          setMessage('Live shared editing is not active yet for this workspace.');
          return;
        }

        setStatus('ready');
        setMessage('Collaboration session is ready for this document.');
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          setStatus('unavailable');
          setExpiresIn(null);
          setMessage('Your session expired. Please sign in again.');
          return;
        }

        setStatus('unavailable');
        setMessage(
          error instanceof ApiError
            ? error.error
            : 'Could not prepare collaboration readiness.',
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
    expiresIn,
    retry,
  };
}
