from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from .. import repository
from ..ai_service import (
    default_prompt_for_history,
    generate_ai_response,
    prepare_ai_request,
    sse_event,
    stream_ai_events,
)
from ..deps import get_connection, get_current_user
from ..schemas import (
    AiDecisionRequest,
    AiHistoryResponse,
    AiSuggestRequest,
    AiSuggestResponse,
    MessageResponse,
)

router = APIRouter(prefix="/api/documents/{document_id}/ai", tags=["ai"])


def _resolve_editable_document(connection, document_id: int, user_id: int):
    document, role = repository.resolve_document_access(connection, document_id, user_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role not in {"owner", "editor"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI is only available to editors",
        )
    return document


@router.post("/suggest", response_model=AiSuggestResponse)
async def suggest(
    document_id: int,
    payload: AiSuggestRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = _resolve_editable_document(connection, document_id, current_user["id"])
    prepared = prepare_ai_request(
        connection=connection,
        document_id=document_id,
        user_id=current_user["id"],
        document=document,
        prompt=default_prompt_for_history(
            payload.prompt or "",
            payload.feature,
            payload.context or "document",
        ),
        feature=payload.feature,
        context=payload.context,
        context_text=payload.context_text,
        tone=payload.tone,
        summary_length=payload.summary_length,
        summary_format=payload.summary_format,
    )
    suggestion = await generate_ai_response(prepared)
    repository.update_ai_interaction_result(
        connection,
        interaction_id=prepared.interaction_id,
        response=suggestion,
        status="generated",
        error_message=None,
    )
    connection.commit()

    return {
        "interaction_id": prepared.interaction_id,
        "suggestion": suggestion,
        "model": prepared.model,
        "status": "generated",
        "feature": prepared.feature,
        "context_preview": prepared.context_preview,
    }


@router.post("/suggest/stream")
async def suggest_stream(
    document_id: int,
    payload: AiSuggestRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    document = _resolve_editable_document(connection, document_id, current_user["id"])
    prepared = prepare_ai_request(
        connection=connection,
        document_id=document_id,
        user_id=current_user["id"],
        document=document,
        prompt=default_prompt_for_history(
            payload.prompt or "",
            payload.feature,
            payload.context or "document",
        ),
        feature=payload.feature,
        context=payload.context,
        context_text=payload.context_text,
        tone=payload.tone,
        summary_length=payload.summary_length,
        summary_format=payload.summary_format,
    )

    async def event_stream():
        async for event_name, event_payload in stream_ai_events(
            connection=connection,
            prepared=prepared,
        ):
            yield sse_event(event_name, event_payload)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/history", response_model=AiHistoryResponse)
def history(document_id: int, current_user=Depends(get_current_user), connection=Depends(get_connection)):
    document, role = repository.resolve_document_access(connection, document_id, current_user["id"])
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {"history": repository.list_ai_history(connection, document_id)}


@router.post("/history/{interaction_id}/decision", response_model=MessageResponse)
def update_decision(
    document_id: int,
    interaction_id: int,
    payload: AiDecisionRequest,
    current_user=Depends(get_current_user),
    connection=Depends(get_connection),
):
    _resolve_editable_document(connection, document_id, current_user["id"])
    updated = repository.set_ai_interaction_status(
        connection,
        document_id=document_id,
        interaction_id=interaction_id,
        status=payload.status,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI interaction not found")

    return {"message": "AI interaction updated"}
