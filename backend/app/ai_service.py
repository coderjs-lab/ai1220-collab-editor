from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
import sqlite3

from . import repository
from .ai_prompts import build_prompt_package
from .ai_provider import AnthropicAiProvider, StubAiProvider
from .config import settings
from .content import content_to_plain_text


@dataclass(frozen=True)
class PreparedAiRequest:
    interaction_id: int
    model: str
    feature: str
    context_scope: str
    context_preview: str
    system_prompt: str
    user_prompt: str


def get_ai_provider():
    if settings.ai_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("AI provider is set to anthropic but ANTHROPIC_API_KEY is missing.")
        return AnthropicAiProvider(settings.anthropic_api_key)

    return StubAiProvider()


def prepare_ai_request(
    *,
    connection: sqlite3.Connection,
    document_id: int,
    user_id: int,
    document: sqlite3.Row,
    prompt: str | None,
    feature: str,
    context: str | None,
    context_text: str | None,
    tone: str | None,
    summary_length: str | None,
    summary_format: str | None,
) -> PreparedAiRequest:
    prompt_package = build_prompt_package(
        title=document["title"],
        content=document["content"],
        feature=feature,
        prompt=prompt,
        requested_scope=context,
        selected_text=context_text,
        tone=tone,
        summary_length=summary_length,
        summary_format=summary_format,
    )

    interaction_id = repository.create_ai_interaction(
        connection,
        document_id=document_id,
        user_id=user_id,
        prompt=(prompt or "").strip(),
        model=settings.ai_model,
        status="streaming",
        feature=prompt_package.feature,
        context_scope=prompt_package.context_scope,
        context_preview=prompt_package.context_preview,
        resolved_prompt=prompt_package.resolved_prompt,
    )
    connection.commit()

    return PreparedAiRequest(
        interaction_id=interaction_id,
        model=settings.ai_model,
        feature=prompt_package.feature,
        context_scope=prompt_package.context_scope,
        context_preview=prompt_package.context_preview,
        system_prompt=prompt_package.system_prompt,
        user_prompt=prompt_package.user_prompt,
    )


async def generate_ai_response(prepared: PreparedAiRequest) -> str:
    provider = get_ai_provider()
    chunks: list[str] = []
    async for chunk in provider.stream_text(
        system_prompt=prepared.system_prompt,
        user_prompt=prepared.user_prompt,
        model=prepared.model,
        max_output_tokens=settings.ai_max_output_tokens,
        feature=prepared.feature,
        context_preview=prepared.context_preview,
    ):
        chunks.append(chunk)

    suggestion = "".join(chunks).strip()
    if not suggestion:
        raise RuntimeError("The AI provider returned an empty response.")
    return suggestion


async def stream_ai_events(
    *,
    connection: sqlite3.Connection,
    prepared: PreparedAiRequest,
) -> AsyncIterator[tuple[str, dict[str, str | int | None]]]:
    provider = get_ai_provider()
    chunks: list[str] = []

    yield (
        "meta",
        {
            "interaction_id": prepared.interaction_id,
            "model": prepared.model,
            "feature": prepared.feature,
            "context_scope": prepared.context_scope,
            "context_preview": prepared.context_preview,
            "status": "streaming",
        },
    )

    try:
        async for chunk in provider.stream_text(
            system_prompt=prepared.system_prompt,
            user_prompt=prepared.user_prompt,
            model=prepared.model,
            max_output_tokens=settings.ai_max_output_tokens,
            feature=prepared.feature,
            context_preview=prepared.context_preview,
        ):
            if not chunk:
                continue
            chunks.append(chunk)
            yield ("chunk", {"text": chunk})

        suggestion = "".join(chunks).strip()
        if not suggestion:
            raise RuntimeError("The AI provider returned an empty response.")

        repository.update_ai_interaction_result(
            connection,
            interaction_id=prepared.interaction_id,
            response=suggestion,
            status="generated",
            error_message=None,
        )
        connection.commit()
        yield (
            "done",
            {
                "interaction_id": prepared.interaction_id,
                "model": prepared.model,
                "feature": prepared.feature,
                "status": "generated",
            },
        )
    except asyncio.CancelledError:
        repository.update_ai_interaction_result(
            connection,
            interaction_id=prepared.interaction_id,
            response="".join(chunks).strip() or None,
            status="cancelled",
            error_message=None,
        )
        connection.commit()
        raise
    except Exception as exc:
        repository.update_ai_interaction_result(
            connection,
            interaction_id=prepared.interaction_id,
            response="".join(chunks).strip() or None,
            status="failed",
            error_message=str(exc),
        )
        connection.commit()
        yield (
            "error",
            {
                "interaction_id": prepared.interaction_id,
                "message": str(exc),
                "partial": "".join(chunks).strip() or None,
            },
        )


def sse_event(event: str, payload: dict[str, str | int | None]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def default_prompt_for_history(prompt: str, feature: str, context_scope: str) -> str:
    if prompt.strip():
        return prompt.strip()

    if feature == "rewrite":
        return "Rewrite the selected content."
    if feature == "summarize":
        return "Summarize the current draft."
    if feature == "expand":
        return "Expand the current draft."
    if feature == "fix_grammar":
        return "Fix grammar and spelling."

    return f"Custom AI request for {context_scope} context."


def build_history_fallback_text(document: sqlite3.Row) -> str:
    return content_to_plain_text(document["content"]).strip()
