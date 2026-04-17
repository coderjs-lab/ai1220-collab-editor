from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


Role = Literal["owner", "editor", "viewer"]
ShareRole = Literal["editor", "viewer"]


class ApiUser(BaseModel):
    id: int
    username: str
    email: str


class ApiDocument(BaseModel):
    id: int
    title: str
    content: dict[str, Any]
    owner_id: int
    created_at: str
    updated_at: str


class ApiCollaborator(BaseModel):
    id: int
    username: str
    email: str
    role: ShareRole


class ApiVersion(BaseModel):
    id: int
    document_id: int
    created_by: int
    created_by_username: str
    content: dict[str, Any]
    created_at: str
    restored_from: int | None = None


class ApiAiHistoryItem(BaseModel):
    id: int
    prompt: str
    response: str | None
    created_at: str
    username: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class CreateDocumentRequest(BaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None


class UpdateDocumentRequest(BaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None


class ShareDocumentRequest(BaseModel):
    email: str = Field(min_length=3)
    role: ShareRole


class AiSuggestRequest(BaseModel):
    prompt: str = Field(min_length=1)
    context: str | None = None


class AuthResponse(BaseModel):
    user: ApiUser
    token: str


class MeResponse(BaseModel):
    user: ApiUser


class DocumentResponse(BaseModel):
    document: ApiDocument


class DocumentListResponse(BaseModel):
    documents: list[ApiDocument]


class DocumentDetailResponse(BaseModel):
    document: ApiDocument
    collaborators: list[ApiCollaborator]


class ShareDocumentResponse(BaseModel):
    permission: dict[str, Any]


class DeleteDocumentResponse(BaseModel):
    message: str


class DocumentVersionsResponse(BaseModel):
    versions: list[ApiVersion]


class AiHistoryResponse(BaseModel):
    history: list[ApiAiHistoryItem]


class AiSuggestResponse(BaseModel):
    suggestion: str


class DocumentSessionResponse(BaseModel):
    session_token: str
    ws_url: str
    expires_in: int
    role: Role


class HealthResponse(BaseModel):
    status: str


class ApiErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    error: str
