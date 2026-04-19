from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..config import settings
from ..deps import get_connection, get_current_user
from ..schemas import DocumentSessionResponse
from ..security import create_collab_session_token

router = APIRouter(prefix="/api/documents/{document_id}/session", tags=["collaboration"])


@router.post("", response_model=DocumentSessionResponse)
def create_session(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    session_token = create_collab_session_token(
        user=current_user,
        document_id=document_id,
        role=role,
    )
    return {
        "session_token": session_token,
        "ws_url": settings.ws_base_url,
        "expires_in": settings.collab_session_ttl_seconds,
        "role": role,
    }
