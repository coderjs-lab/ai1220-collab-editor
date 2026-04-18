import {
  type AcceptShareLinkResponse,
  type AiHistoryResponse,
  type AiSuggestRequest,
  type AiSuggestResponse,
  type AuthResponse,
  type CreateDocumentRequest,
  type CreateShareLinkRequest,
  type DeleteDocumentResponse,
  type DocumentDetailResponse,
  type DocumentListResponse,
  type DocumentResponse,
  type DocumentSessionResponse,
  type DocumentShareLinksResponse,
  type DocumentVersionsResponse,
  type LoginRequest,
  type LogoutResponse,
  type MeResponse,
  type RegisterRequest,
  type ShareLinkResponse,
  type ShareDocumentRequest,
  type ShareDocumentResponse,
  type UpdateDocumentRequest,
} from '../types/api';
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from './storage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  error: string;

  constructor(status: number, error: string) {
    super(error);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
  }
}

function dispatchUnauthorized(message: string) {
  window.dispatchEvent(
    new CustomEvent('app:unauthorized', {
      detail: { message },
    }),
  );
}

function getErrorMessage(payload: unknown) {
  return payload &&
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
    ? payload.error
    : 'Unexpected API error';
}

async function parsePayload<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<AuthResponse | null> | null = null;

async function refreshAccessToken(options?: {
  suppressUnauthorizedEvent?: boolean;
}): Promise<AuthResponse | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    const payload = await parsePayload<AuthResponse>(response);

    if (!response.ok || !payload) {
      clearStoredToken();
      if (response.status === 401 && !options?.suppressUnauthorizedEvent) {
        dispatchUnauthorized(getErrorMessage(payload));
      }
      return null;
    }

    setStoredToken(payload.token);
    return payload;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  retryOnUnauthorized?: boolean;
  suppressUnauthorizedEvent?: boolean;
  omitAuth?: boolean;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const {
    retryOnUnauthorized = true,
    suppressUnauthorizedEvent = false,
    omitAuth = false,
    ...requestInit
  } = init ?? {};

  const headers = new Headers(requestInit.headers);
  const token = omitAuth ? null : getStoredToken();

  if (!headers.has('Content-Type') && requestInit.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers,
    credentials: 'include',
  });
  let payload = await parsePayload<T>(response);

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshAccessToken({ suppressUnauthorizedEvent });
    if (refreshed) {
      const retryHeaders = new Headers(requestInit.headers);
      if (!retryHeaders.has('Content-Type') && requestInit.body) {
        retryHeaders.set('Content-Type', 'application/json');
      }
      retryHeaders.set('Authorization', `Bearer ${refreshed.token}`);

      response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestInit,
        headers: retryHeaders,
        credentials: 'include',
      });
      payload = await parsePayload<T>(response);
    }
  }

  if (!response.ok) {
    const message = getErrorMessage(payload);

    if (response.status === 401) {
      clearStoredToken();
      if (!suppressUnauthorizedEvent) {
        dispatchUnauthorized(message);
      }
    }

    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export const api = {
  auth: {
    register(body: RegisterRequest) {
      return request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
        omitAuth: true,
        retryOnUnauthorized: false,
      });
    },
    login(body: LoginRequest) {
      return request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
        omitAuth: true,
        retryOnUnauthorized: false,
      });
    },
    me() {
      return request<MeResponse>('/auth/me');
    },
    async restoreSession() {
      const token = getStoredToken();

      if (token) {
        try {
          const response = await request<MeResponse>('/auth/me', {
            suppressUnauthorizedEvent: true,
          });

          return {
            user: response.user,
            token: getStoredToken() ?? token,
          } satisfies AuthResponse;
        } catch {
          clearStoredToken();
        }
      }

      return refreshAccessToken({ suppressUnauthorizedEvent: true });
    },
    logout() {
      return request<LogoutResponse>('/auth/logout', {
        method: 'POST',
        retryOnUnauthorized: false,
        suppressUnauthorizedEvent: true,
      });
    },
  },
  documents: {
    list() {
      return request<DocumentListResponse>('/documents');
    },
    create(body: CreateDocumentRequest) {
      return request<DocumentResponse>('/documents', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    get(id: string) {
      return request<DocumentDetailResponse>(`/documents/${id}`);
    },
    update(id: string, body: UpdateDocumentRequest) {
      return request<DocumentResponse>(`/documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    remove(id: string) {
      return request<DeleteDocumentResponse>(`/documents/${id}`, {
        method: 'DELETE',
      });
    },
    share(id: string, body: ShareDocumentRequest) {
      return request<ShareDocumentResponse>(`/documents/${id}/share`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    revokeShare(id: string, userId: number) {
      return request<DeleteDocumentResponse>(`/documents/${id}/share/${userId}`, {
        method: 'DELETE',
      });
    },
    versions(id: string, includeFull = false) {
      const query = includeFull ? '?full=1' : '';
      return request<DocumentVersionsResponse>(`/documents/${id}/versions${query}`);
    },
    restoreVersion(id: string, versionId: number) {
      return request<DocumentResponse>(`/documents/${id}/versions/${versionId}/restore`, {
        method: 'POST',
      });
    },
  },
  shareLinks: {
    list(documentId: string) {
      return request<DocumentShareLinksResponse>(`/documents/${documentId}/share-links`);
    },
    create(documentId: string, body: CreateShareLinkRequest) {
      return request<ShareLinkResponse>(`/documents/${documentId}/share-links`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    revoke(documentId: string, linkId: number) {
      return request<DeleteDocumentResponse>(`/documents/${documentId}/share-links/${linkId}`, {
        method: 'DELETE',
      });
    },
    accept(token: string) {
      return request<AcceptShareLinkResponse>(`/share-links/${token}/accept`, {
        method: 'POST',
      });
    },
  },
  ai: {
    suggest(documentId: string, body: AiSuggestRequest) {
      return request<AiSuggestResponse>(`/documents/${documentId}/ai/suggest`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    history(documentId: string) {
      return request<AiHistoryResponse>(`/documents/${documentId}/ai/history`);
    },
  },
  sessions: {
    create(documentId: string) {
      return request<DocumentSessionResponse>(`/documents/${documentId}/session`, {
        method: 'POST',
      });
    },
  },
};
