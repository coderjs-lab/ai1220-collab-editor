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


@router.get("", response_model=DocumentListResponse)
def list_documents(current_user=Depends(get_current_user), connection=Depends(get_connection)):
    return {"documents": repository.list_documents_for_user(connection, current_user["id"])}


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("/{document_id}", response_model=DocumentDetailResponse)
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


@router.put("/{document_id}", response_model=DocumentResponse)
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


@router.delete("/{document_id}", response_model=DeleteDocumentResponse)
def delete_document(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document = repository.find_document(connection, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can delete")

    repository.delete_document(connection, document_id)
    return {"message": "Document deleted"}


@router.get("/{document_id}/versions", response_model=DocumentVersionsResponse)
def get_versions(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {"versions": repository.list_versions(connection, document_id)}


@router.post("/{document_id}/versions/{version_id}/restore", response_model=DocumentResponse)
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
