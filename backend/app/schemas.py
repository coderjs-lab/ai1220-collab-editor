from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Role = Literal["owner", "editor", "viewer"]
ShareRole = Literal["editor", "viewer"]
AiFeature = Literal["rewrite", "summarize", "expand", "fix_grammar", "custom"]
AiContextScope = Literal["selection", "section", "document"]
AiDecisionStatus = Literal["accepted", "rejected", "partial", "edited"]


class ApiBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class ApiUser(ApiBaseModel):
    id: int
    username: str
    email: str


class ApiDocument(ApiBaseModel):
    id: int
    title: str
    content: dict[str, Any]
    owner_id: int
    created_at: str
    updated_at: str


class ApiCollaborator(ApiBaseModel):
    id: int
    username: str
    email: str
    role: ShareRole


class ApiVersion(ApiBaseModel):
    id: int
    document_id: int
    created_by: int
    created_by_username: str
    content: dict[str, Any]
    created_at: str
    restored_from: int | None = None


class ApiAiHistoryItem(ApiBaseModel):
    id: int
    prompt: str
    response: str | None
    created_at: str
    username: str
    model: str | None = None
    status: str | None = None
    feature: AiFeature | None = None
    context_scope: AiContextScope | None = None
    context_preview: str | None = None


class ApiShareLink(ApiBaseModel):
    id: int
    role: ShareRole
    token: str
    url: str
    created_at: str
    revoked_at: str | None = None


class RegisterRequest(ApiBaseModel):
    username: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)


class LoginRequest(ApiBaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class CreateDocumentRequest(ApiBaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None


class UpdateDocumentRequest(ApiBaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None


class ShareDocumentRequest(ApiBaseModel):
    identifier: str | None = None
    email: str | None = None
    role: ShareRole

    @model_validator(mode="after")
    def validate_identifier(self) -> "ShareDocumentRequest":
        if not self.identifier and not self.email:
            raise ValueError("identifier or email is required")
        return self


class AiSuggestRequest(ApiBaseModel):
    prompt: str | None = None
    context: AiContextScope | None = None
    context_text: str | None = None
    feature: AiFeature = "custom"
    tone: Literal["professional", "friendly", "confident", "concise"] | None = None
    summary_length: Literal["short", "medium", "long"] | None = None
    summary_format: Literal["paragraph", "bullets"] | None = None

    @model_validator(mode="after")
    def validate_ai_request(self) -> "AiSuggestRequest":
        if self.feature == "custom" and not (self.prompt or "").strip():
            raise ValueError("prompt is required for a custom assistant request")
        return self


class AiDecisionRequest(ApiBaseModel):
    status: AiDecisionStatus


class CreateShareLinkRequest(ApiBaseModel):
    role: ShareRole


class AuthResponse(ApiBaseModel):
    user: ApiUser
    token: str


class MeResponse(ApiBaseModel):
    user: ApiUser


class MessageResponse(ApiBaseModel):
    message: str


class DocumentResponse(ApiBaseModel):
    document: ApiDocument


class DocumentListResponse(ApiBaseModel):
    documents: list[ApiDocument]


class DocumentDetailResponse(ApiBaseModel):
    document: ApiDocument
    collaborators: list[ApiCollaborator]


class SharePermission(ApiBaseModel):
    user: ApiUser
    role: ShareRole


class ShareDocumentResponse(ApiBaseModel):
    permission: SharePermission


class ShareLinkResponse(ApiBaseModel):
    share_link: ApiShareLink


class DocumentShareLinksResponse(ApiBaseModel):
    share_links: list[ApiShareLink]


class AcceptShareLinkResponse(ApiBaseModel):
    document: ApiDocument
    role: Role


class DeleteDocumentResponse(ApiBaseModel):
    message: str


class DocumentVersionsResponse(ApiBaseModel):
    versions: list[ApiVersion]


class AiHistoryResponse(ApiBaseModel):
    history: list[ApiAiHistoryItem]


class AiSuggestResponse(ApiBaseModel):
    interaction_id: int
    suggestion: str
    model: str
    status: str
    feature: AiFeature
    context_preview: str


class DocumentSessionResponse(ApiBaseModel):
    session_token: str
    ws_url: str
    expires_in: int
    role: Role


class HealthResponse(ApiBaseModel):
    status: str


class ApiErrorResponse(ApiBaseModel):
    model_config = ConfigDict(extra="forbid")
    error: str
