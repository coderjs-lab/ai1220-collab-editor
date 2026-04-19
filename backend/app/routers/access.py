from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..deps import get_connection, get_current_user
from ..schemas import DeleteDocumentResponse, ShareDocumentRequest, ShareDocumentResponse

router = APIRouter(prefix="/api/documents/{document_id}/share", tags=["sharing"])


@router.post(
    "",
    response_model=ShareDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Share a document with a user",
    description="Owner-only route that grants or updates viewer/editor access for a target user identified by username or email.",
)
def share_document(
    document_id: int,
    payload: ShareDocumentRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = repository.find_document(connection, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can share")

    identifier = (payload.identifier or payload.email or "").strip()
    target = repository.find_user_by_identifier(connection, identifier)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target["id"] == current_user["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot share with yourself")

    permission = repository.upsert_permission(connection, document_id, target["id"], payload.role)
    return {"permission": permission}


@router.delete(
    "/{user_id}",
    response_model=DeleteDocumentResponse,
    summary="Revoke direct collaborator access",
    description="Owner-only route that removes an existing direct collaborator permission from the document.",
)
def revoke_access(
    document_id: int,
    user_id: int,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = repository.find_document(connection, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can revoke access")

    repository.revoke_permission(connection, document_id, user_id)
    return {"message": "Access revoked"}
