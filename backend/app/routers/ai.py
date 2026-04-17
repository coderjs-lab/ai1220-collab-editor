from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..content import content_to_plain_text
from ..deps import get_connection, get_current_user
from ..schemas import AiHistoryResponse, AiSuggestRequest, AiSuggestResponse

router = APIRouter(prefix="/api/documents/{document_id}/ai", tags=["ai"])


@router.post("/suggest", response_model=AiSuggestResponse)
def suggest(
    document_id: int,
    payload: AiSuggestRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role not in {"owner", "editor"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="AI is only available to editors")

    plain_text = content_to_plain_text(document["content"])
    suggestion = (
        f"Prompt: {payload.prompt.strip()}\n\n"
        f"Context scope: {payload.context or 'document'}\n\n"
        f"Draft excerpt:\n{plain_text[:500] or 'Document is empty.'}"
    )
    repository.insert_ai_interaction(connection, document_id, current_user["id"], payload.prompt, suggestion)
    return {"suggestion": suggestion}


@router.get("/history", response_model=AiHistoryResponse)
def history(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {"history": repository.list_ai_history(connection, document_id)}

