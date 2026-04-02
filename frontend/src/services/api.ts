import {
  type AiHistoryResponse,
  type AiSuggestRequest,
  type AiSuggestResponse,
  type AuthResponse,
  type CreateDocumentRequest,
  type DeleteDocumentResponse,
  type DocumentDetailResponse,
  type DocumentListResponse,
  type DocumentResponse,
  type DocumentVersionsResponse,
  type LoginRequest,
  type MeResponse,
  type RegisterRequest,
  type ShareDocumentRequest,
  type ShareDocumentResponse,
  type UpdateDocumentRequest,
} from '../types/api';
import { clearStoredToken, getStoredToken } from './storage';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Unexpected API error';

    if (response.status === 401) {
      clearStoredToken();
      dispatchUnauthorized(message);
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
      });
    },
    login(body: LoginRequest) {
      return request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    me() {
      return request<MeResponse>('/auth/me');
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
};
