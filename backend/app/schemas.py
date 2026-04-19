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
    id: int = Field(description="Stable numeric identifier for the user.")
    username: str = Field(description="Public username shown in collaboration and history UI.")
    email: str = Field(description="Email address used for authentication and sharing.")


class ApiDocument(ApiBaseModel):
    id: int = Field(description="Stable numeric document identifier.")
    title: str = Field(description="Human-readable title displayed in the dashboard and editor.")
    content: dict[str, Any] = Field(description="Structured Tiptap/ProseMirror-compatible rich-text JSON.")
    owner_id: int = Field(description="User ID of the document owner.")
    created_at: str = Field(description="UTC timestamp for document creation.")
    updated_at: str = Field(description="UTC timestamp for the latest persisted update.")


class ApiCollaborator(ApiBaseModel):
    id: int = Field(description="User ID of the collaborator.")
    username: str = Field(description="Collaborator username.")
    email: str = Field(description="Collaborator email address.")
    role: ShareRole = Field(description="Effective direct-share role for the collaborator.")


class ApiVersion(ApiBaseModel):
    id: int = Field(description="Version checkpoint identifier.")
    document_id: int = Field(description="Document associated with this saved version.")
    created_by: int = Field(description="User ID that created the checkpoint or restore event.")
    created_by_username: str = Field(description="Username of the actor that created the checkpoint.")
    content: dict[str, Any] = Field(description="Rich-text JSON snapshot stored for this version.")
    created_at: str = Field(description="UTC timestamp when the version was recorded.")
    restored_from: int | None = Field(default=None, description="Previous version ID if this checkpoint came from a restore action.")


class ApiAiHistoryItem(ApiBaseModel):
    id: int = Field(description="AI interaction identifier.")
    prompt: str = Field(description="Prompt or instruction recorded for the interaction.")
    response: str | None = Field(description="Generated response text, if available.")
    created_at: str = Field(description="UTC timestamp when the AI interaction was created.")
    username: str = Field(description="Username of the person who invoked the assistant.")
    model: str | None = Field(default=None, description="Provider model name used for generation.")
    status: str | None = Field(default=None, description="Current human review status for the interaction.")
    feature: AiFeature | None = Field(default=None, description="Assistant feature used for the request.")
    context_scope: AiContextScope | None = Field(default=None, description="Context scope used to construct the AI prompt.")
    context_preview: str | None = Field(default=None, description="Short preview of the document context sent to the AI provider.")


class ApiShareLink(ApiBaseModel):
    id: int = Field(description="Share-link identifier.")
    role: ShareRole = Field(description="Role granted to users who accept the link.")
    token: str = Field(description="Opaque token segment used to accept the share link.")
    url: str = Field(description="Frontend URL that a user can visit to accept the link.")
    created_at: str = Field(description="UTC timestamp when the link was created.")
    revoked_at: str | None = Field(default=None, description="UTC timestamp when the link was revoked, if applicable.")


class RegisterRequest(ApiBaseModel):
    username: str = Field(min_length=1, description="Desired public username.")
    email: str = Field(min_length=3, description="Email address for sign-in.")
    password: str = Field(min_length=6, description="Plain-text password supplied during registration.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "username": "harman",
                "email": "harman@example.com",
                "password": "password123",
            }
        },
    )


class LoginRequest(ApiBaseModel):
    email: str = Field(min_length=3, description="Email address for sign-in.")
    password: str = Field(min_length=1, description="Plain-text password for the account.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "email": "harman@example.com",
                "password": "password123",
            }
        },
    )


class CreateDocumentRequest(ApiBaseModel):
    title: str | None = Field(default=None, description="Optional title for the new document.")
    content: dict[str, Any] | None = Field(default=None, description="Optional initial rich-text JSON content.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "title": "Project outline",
                "content": {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "First paragraph"}],
                        }
                    ],
                },
            }
        },
    )


class UpdateDocumentRequest(ApiBaseModel):
    title: str | None = Field(default=None, description="Replacement title for the document.")
    content: dict[str, Any] | None = Field(default=None, description="Replacement rich-text JSON content.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "title": "Project outline v2",
                "content": {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "Updated paragraph"}],
                        }
                    ],
                },
            }
        },
    )


class ShareDocumentRequest(ApiBaseModel):
    identifier: str | None = Field(default=None, description="Username or email used to find the target collaborator.")
    email: str | None = Field(default=None, description="Legacy email-only share field kept for compatibility.")
    role: ShareRole = Field(description="Role granted to the shared collaborator.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "identifier": "teammate@example.com",
                "role": "editor",
            }
        },
    )

    @model_validator(mode="after")
    def validate_identifier(self) -> "ShareDocumentRequest":
        if not self.identifier and not self.email:
            raise ValueError("identifier or email is required")
        return self


class AiSuggestRequest(ApiBaseModel):
    prompt: str | None = Field(default=None, description="Optional custom instruction supplied by the user.")
    context: AiContextScope | None = Field(default=None, description="Requested context scope for the AI prompt package.")
    context_text: str | None = Field(default=None, description="Explicit selection text or context snippet sent from the editor.")
    feature: AiFeature = Field(default="custom", description="Assistant capability to invoke.")
    tone: Literal["professional", "friendly", "confident", "concise"] | None = Field(default=None, description="Tone hint used by rewrite-style prompts.")
    summary_length: Literal["short", "medium", "long"] | None = Field(default=None, description="Requested summary length when feature is summarize.")
    summary_format: Literal["paragraph", "bullets"] | None = Field(default=None, description="Requested summary format when feature is summarize.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "feature": "summarize",
                "context": "section",
                "context_text": "Draftboard combines rich-text editing, collaboration, and AI review.",
                "summary_length": "short",
                "summary_format": "paragraph",
            }
        },
    )

    @model_validator(mode="after")
    def validate_ai_request(self) -> "AiSuggestRequest":
        if self.feature == "custom" and not (self.prompt or "").strip():
            raise ValueError("prompt is required for a custom assistant request")
        return self


class AiDecisionRequest(ApiBaseModel):
    status: AiDecisionStatus = Field(description="Human review outcome recorded for the AI interaction.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={"example": {"status": "accepted"}},
    )


class CreateShareLinkRequest(ApiBaseModel):
    role: ShareRole = Field(description="Role granted to users who accept the link.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={"example": {"role": "viewer"}},
    )


class AuthResponse(ApiBaseModel):
    user: ApiUser = Field(description="Authenticated user profile.")
    token: str = Field(description="Short-lived JWT access token for authenticated API calls.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "user": {
                    "id": 1,
                    "username": "harman",
                    "email": "harman@example.com",
                },
                "token": "<jwt-access-token>",
            }
        },
    )


class MeResponse(ApiBaseModel):
    user: ApiUser = Field(description="Current authenticated user profile.")


class MessageResponse(ApiBaseModel):
    message: str = Field(description="Human-readable success message.")


class DocumentResponse(ApiBaseModel):
    document: ApiDocument = Field(description="Document payload returned by the API.")


class DocumentListResponse(ApiBaseModel):
    documents: list[ApiDocument] = Field(description="Documents the current user can access.")


class DocumentDetailResponse(ApiBaseModel):
    document: ApiDocument = Field(description="Requested document payload.")
    collaborators: list[ApiCollaborator] = Field(description="Direct collaborators currently attached to the document.")


class SharePermission(ApiBaseModel):
    user: ApiUser = Field(description="User that received the share permission.")
    role: ShareRole = Field(description="Role granted to the shared user.")


class ShareDocumentResponse(ApiBaseModel):
    permission: SharePermission = Field(description="New or updated collaborator permission.")


class ShareLinkResponse(ApiBaseModel):
    share_link: ApiShareLink = Field(description="Created share-link payload.")


class DocumentShareLinksResponse(ApiBaseModel):
    share_links: list[ApiShareLink] = Field(description="Active share links for the document.")


class AcceptShareLinkResponse(ApiBaseModel):
    document: ApiDocument = Field(description="Document payload now accessible to the accepting user.")
    role: Role = Field(description="Effective role the user has after accepting the link.")


class DeleteDocumentResponse(ApiBaseModel):
    message: str = Field(description="Human-readable success message.")


class DocumentVersionsResponse(ApiBaseModel):
    versions: list[ApiVersion] = Field(description="Saved checkpoints for the document.")


class AiHistoryResponse(ApiBaseModel):
    history: list[ApiAiHistoryItem] = Field(description="Prior AI interactions for the document.")


class AiSuggestResponse(ApiBaseModel):
    interaction_id: int = Field(description="Persisted AI interaction identifier.")
    suggestion: str = Field(description="Generated AI suggestion text.")
    model: str = Field(description="Provider model used to generate the suggestion.")
    status: str = Field(description="Generation status recorded for this interaction.")
    feature: AiFeature = Field(description="Assistant feature used to produce the suggestion.")
    context_preview: str = Field(description="Short preview of the prompt context sent to the provider.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "interaction_id": 42,
                "suggestion": "Draftboard combines collaborative editing with AI-assisted revision.",
                "model": "draftboard-stub-v1",
                "status": "generated",
                "feature": "summarize",
                "context_preview": "Draftboard combines rich-text editing, collaboration, and AI review.",
            }
        },
    )


class DocumentSessionResponse(ApiBaseModel):
    session_token: str = Field(description="Short-lived JWT for the document-scoped collaboration websocket.")
    ws_url: str = Field(description="Websocket base URL the frontend should connect to.")
    expires_in: int = Field(description="Session token lifetime in seconds.")
    role: Role = Field(description="Effective document role for the websocket session.")
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "session_token": "<collab-jwt>",
                "ws_url": "ws://localhost:3001/ws/collab",
                "expires_in": 1800,
                "role": "editor",
            }
        },
    )


class HealthResponse(ApiBaseModel):
    status: str = Field(description="Backend health status.")


class ApiErrorResponse(ApiBaseModel):
    model_config = ConfigDict(extra="forbid")
    error: str = Field(description="Human-readable error message returned by the API.")
