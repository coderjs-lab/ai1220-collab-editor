from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..config import settings
from ..deps import get_connection, get_current_user
from ..schemas import (
    AcceptShareLinkResponse,
    CreateShareLinkRequest,
    DeleteDocumentResponse,
    DocumentShareLinksResponse,
    ShareLinkResponse,
)


router = APIRouter(tags=["share-links"])


def _share_link_url(token: str) -> str:
    origin = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
    return f"{origin.rstrip('/')}/share/{token}"


@router.get(
    "/api/documents/{document_id}/share-links",
    response_model=DocumentShareLinksResponse,
    summary="List active share links",
    description="Owner-only route that returns every non-revoked share link for the document.",
)
def list_document_share_links(
    document_id: int,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = repository.find_document(connection, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can manage share links")

    share_links = [
        {
            **share_link,
            "url": _share_link_url(share_link["token"]),
        }
        for share_link in repository.list_share_links(connection, document_id)
    ]
    return {"share_links": share_links}


@router.post(
    "/api/documents/{document_id}/share-links",
    response_model=ShareLinkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a share link",
    description="Owner-only route that creates a new viewer/editor share link for the document.",
)
def create_document_share_link(
    document_id: int,
    payload: CreateShareLinkRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = repository.find_document(connection, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can manage share links")

    share_link = repository.create_share_link(connection, document_id, payload.role, current_user["id"])
    return {
        "share_link": {
            **share_link,
            "url": _share_link_url(share_link["token"]),
        }
    }


@router.delete(
    "/api/documents/{document_id}/share-links/{link_id}",
    response_model=DeleteDocumentResponse,
    summary="Revoke a share link",
    description="Owner-only route that revokes an existing share link so it can no longer be accepted.",
)
def revoke_document_share_link(
    document_id: int,
    link_id: int,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = repository.find_document(connection, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can manage share links")

    repository.revoke_share_link(connection, document_id, link_id)
    return {"message": "Share link revoked"}


@router.post(
    "/api/share-links/{token}/accept",
    response_model=AcceptShareLinkResponse,
    summary="Accept a share link",
    description="Consumes a valid share token and grants the caller the linked document role.",
)
def accept_share_link(
    token: str,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    try:
        document, role = repository.accept_share_link(connection, token, current_user["id"])
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found") from error

    return {
        "document": document,
        "role": role,
    }
