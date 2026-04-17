from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Role = Literal['viewer', 'editor']


class ApiBaseModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class UserOut(ApiBaseModel):
    id: int
    username: str
    email: str


class AuthResponse(ApiBaseModel):
    user: UserOut
    token: str


class RegisterRequest(ApiBaseModel):
    username: str = Field(min_length=3, description='Unique username used for sharing.')
    email: str = Field(description='Email address used for sign-in and sharing.')
    password: str = Field(min_length=8, description='Plain-text password sent only at auth time.')


class LoginRequest(ApiBaseModel):
    email: str = Field(description='Email address used at registration time.')
    password: str = Field(min_length=1, description='Current account password.')


class MeResponse(ApiBaseModel):
    user: UserOut


class MessageResponse(ApiBaseModel):
    message: str


class DocumentOut(ApiBaseModel):
    id: int
    title: str
    content: str
    owner_id: int
    created_at: str
    updated_at: str


class DocumentListResponse(ApiBaseModel):
    documents: list[DocumentOut]


class DocumentResponse(ApiBaseModel):
    document: DocumentOut


class CreateDocumentRequest(ApiBaseModel):
    title: str | None = Field(default=None, description='Document title.')
    content: str | None = Field(default=None, description='Serialized rich-text HTML.')


class UpdateDocumentRequest(ApiBaseModel):
    title: str | None = Field(default=None, description='Updated title, when changed.')
    content: str | None = Field(default=None, description='Updated serialized rich-text HTML.')


class CollaboratorOut(ApiBaseModel):
    id: int
    username: str
    email: str
    role: Role


class DocumentDetailResponse(ApiBaseModel):
    document: DocumentOut
    collaborators: list[CollaboratorOut]


class ShareDocumentRequest(ApiBaseModel):
    identifier: str | None = Field(
        default=None,
        description='Username or email address for the collaborator.',
    )
    email: str | None = Field(
        default=None,
        description='Legacy email field accepted during the identifier migration.',
    )
    role: Role = Field(description='Role granted to the collaborator.')

    @model_validator(mode='after')
    def validate_identifier(self) -> 'ShareDocumentRequest':
        if not self.identifier and not self.email:
            raise ValueError('identifier or email is required')
        return self


class SharePermission(ApiBaseModel):
    user: UserOut
    role: Role


class ShareDocumentResponse(ApiBaseModel):
    permission: SharePermission


class VersionOut(ApiBaseModel):
    id: int
    document_id: int
    created_by: int
    created_at: str
    created_by_username: str
    content: str | None = None


class DocumentVersionsResponse(ApiBaseModel):
    versions: list[VersionOut]


class AiSuggestRequest(ApiBaseModel):
    prompt: str = Field(min_length=1, description='Free-form instruction for the AI assistant.')
    context: str | None = Field(
        default=None,
        description='Context scope or trimmed selection sent alongside the prompt.',
    )


class AiSuggestResponse(ApiBaseModel):
    suggestion: str


class AiHistoryItem(ApiBaseModel):
    id: int
    prompt: str
    response: str | None = None
    created_at: str
    username: str
    model: str | None = None
    status: str | None = None


class AiHistoryResponse(ApiBaseModel):
    history: list[AiHistoryItem]


class DocumentSessionResponse(ApiBaseModel):
    sessionToken: str
    expiresIn: int
