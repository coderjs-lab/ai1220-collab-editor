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

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
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
