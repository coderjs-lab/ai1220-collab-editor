from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..deps import get_connection, get_current_user
from ..schemas import (
    CreateDocumentRequest,
    DeleteDocumentResponse,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentResponse,
    DocumentVersionsResponse,
    UpdateDocumentRequest,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List accessible documents",
    description="Returns every document owned by the caller or shared with them, ordered by most recently updated.",
)
def list_documents(current_user=Depends(get_current_user), connection=Depends(get_connection)):
    return {"documents": repository.list_documents_for_user(connection, current_user["id"])}


@router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a document",
    description="Creates a new document owned by the authenticated user. Content defaults to an empty rich-text document.",
)
def create_document(
    payload: CreateDocumentRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = repository.create_document(
        connection,
        owner_id=current_user["id"],
        title=payload.title,
        content=payload.content,
    )
    return {"document": document}


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Fetch a document and its collaborators",
    description="Returns the document payload plus current collaborator records when the caller has access.",
)
def get_document(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {
        "document": repository.public_document(document),
        "collaborators": repository.list_collaborators(connection, document_id),
    }


@router.put(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Update document title or content",
    description="Updates a document for owners and editors. Content updates also participate in autosave and version checkpointing.",
)
def update_document(
    document_id: int,
    payload: UpdateDocumentRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    if payload.title is None and payload.content is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")

    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role not in {"owner", "editor"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated = repository.update_document(
        connection,
        document_id=document_id,
        user_id=current_user["id"],
        title=payload.title,
        content=payload.content,
    )
    return {"document": updated}


@router.delete(
    "/{document_id}",
    response_model=DeleteDocumentResponse,
    summary="Delete a document",
    description="Deletes a document and all related permissions, versions, share links, and AI history. Owner only.",
)
def delete_document(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document = repository.find_document(connection, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can delete")

    repository.delete_document(connection, document_id)
    return {"message": "Document deleted"}


@router.get(
    "/{document_id}/versions",
    response_model=DocumentVersionsResponse,
    summary="List document versions",
    description="Returns saved version checkpoints for a document in reverse chronological order.",
)
def get_versions(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {"versions": repository.list_versions(connection, document_id)}


@router.post(
    "/{document_id}/versions/{version_id}/restore",
    response_model=DocumentResponse,
    summary="Restore a prior version",
    description="Promotes a saved version to become the document's current content and records the restore action in history.",
)
def restore_version(
    document_id: int,
    version_id: int,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role not in {"owner", "editor"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    try:
        restored = repository.restore_version(connection, document_id, version_id, current_user["id"])
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found") from error

    return {"document": restored}
