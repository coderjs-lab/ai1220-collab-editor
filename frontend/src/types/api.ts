export type RichTextContent = Record<string, unknown>;

export interface ApiUser {
  id: number;
  username: string;
  email: string;
}

export interface ApiDocument {
  id: number;
  title: string;
  content: RichTextContent;
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

export interface ApiShareLink {
  id: number;
  role: 'viewer' | 'editor';
  token: string;
  url: string;
  created_at: string;
  revoked_at?: string | null;
}

export interface ApiVersion {
  id: number;
  document_id: number;
  created_by: number;
  created_at: string;
  created_by_username: string;
  content?: RichTextContent;
  restored_from?: number | null;
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

export interface DocumentShareLinksResponse {
  share_links: ApiShareLink[];
}

export interface AiHistoryResponse {
  history: ApiAiHistoryItem[];
}

export interface DocumentSessionResponse {
  session_token: string;
  ws_url: string;
  expires_in: number;
  role: 'owner' | 'editor' | 'viewer';
}

export interface ShareLinkResponse {
  share_link: ApiShareLink;
}

export interface AcceptShareLinkResponse {
  document: ApiDocument;
  role: 'owner' | 'editor' | 'viewer';
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: RichTextContent;
}

export interface AiSuggestRequest {
  prompt: string;
  context?: string;
}

export interface AiSuggestResponse {
  suggestion: string;
}

export interface ShareDocumentRequest {
  identifier?: string;
  email?: string;
  role: 'viewer' | 'editor';
}

export interface ShareDocumentResponse {
  permission: {
    user: ApiUser;
    role: 'viewer' | 'editor';
  };
}

export interface CreateShareLinkRequest {
  role: 'viewer' | 'editor';
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
  content?: RichTextContent;
}
