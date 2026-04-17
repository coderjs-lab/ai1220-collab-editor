export interface ApiUser {
  id: number;
  username: string;
  email: string;
}

export interface ApiDocument {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface ApiCollaborator {
  id: number;
  username: string;
  email: string;
  role: 'viewer' | 'editor';
}

export interface ApiVersion {
  id: number;
  document_id: number;
  created_by: number;
  created_at: string;
  created_by_username: string;
  content?: string;
}

export interface ApiAiHistoryItem {
  id: number;
  prompt: string;
  response: string | null;
  created_at: string;
  username: string;
  model?: string | null;
  status?: string | null;
}

export interface AuthResponse {
  user: ApiUser;
  token: string;
}

export interface MeResponse {
  user: ApiUser;
}

export interface DocumentListResponse {
  documents: ApiDocument[];
}

export interface DocumentResponse {
  document: ApiDocument;
}

export interface DocumentDetailResponse {
  document: ApiDocument;
  collaborators: ApiCollaborator[];
}

export interface DocumentVersionsResponse {
  versions: ApiVersion[];
}

export interface AiHistoryResponse {
  history: ApiAiHistoryItem[];
}

export interface DocumentSessionResponse {
  sessionToken: string;
  expiresIn: number;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
}

export interface AiSuggestRequest {
  prompt: string;
  context?: string;
}

export interface AiSuggestResponse {
  suggestion: string;
}

export interface ShareDocumentRequest {
  identifier: string;
  role: 'viewer' | 'editor';
}

export interface ShareDocumentResponse {
  permission: {
    user: ApiUser;
    role: 'viewer' | 'editor';
  };
}

export interface DeleteDocumentResponse {
  message: string;
}

export interface LogoutResponse {
  message: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateDocumentRequest {
  title?: string;
  content?: string;
}
