from __future__ import annotations

import os
from typing import Any

from anthropic import APIConnectionError, APIError, APIStatusError, Anthropic, APITimeoutError, RateLimitError
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

SYSTEM_PROMPT = (
    "You are an AI writing assistant embedded in a collaborative document editor. "
    "You help users rewrite, summarize, translate, and restructure text."
)

app = FastAPI(title="AI Service", version="0.1.0")


class CompleteRequest(BaseModel):
    prompt: str | None = None
    document_context: str | None = None
    scope: str = "document"


class CompleteResponse(BaseModel):
    suggestion: str


def build_prompt(prompt: str, document_context: str | None = None, scope: str = "document") -> str:
    normalized_prompt = prompt.strip()
    normalized_context = (document_context or "").strip()

    if not normalized_context:
        return normalized_prompt

    return (
        f"Context scope: {scope}\n"
        "Document context:\n"
        f"{normalized_context}\n\n"
        "User request:\n"
        f"{normalized_prompt}"
    )


def get_client() -> Anthropic:
    existing = getattr(app.state, "anthropic", None)
    if existing is not None:
        return existing

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    client = Anthropic(api_key=api_key)
    app.state.anthropic = client
    return client


def extract_text(response: Any) -> str:
    pieces: list[str] = []
    for block in getattr(response, "content", []) or []:
        text = block.get("text") if isinstance(block, dict) else getattr(block, "text", None)
        if text:
            pieces.append(text)
    return "".join(pieces).strip()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/complete", response_model=CompleteResponse)
async def complete(payload: CompleteRequest) -> CompleteResponse:
    if payload.prompt is None or not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    client = get_client()
    model = os.getenv("AI_MODEL", "claude-3-5-haiku-latest")
    max_tokens = int(os.getenv("AI_MAX_TOKENS", "1024"))

    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": build_prompt(
                        payload.prompt,
                        document_context=payload.document_context,
                        scope=payload.scope,
                    ),
                }
            ],
        )
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail="LLM rate limit exceeded") from exc
    except (APIConnectionError, APITimeoutError) as exc:
        raise HTTPException(status_code=502, detail="LLM provider is unreachable") from exc
    except APIStatusError as exc:
        if exc.status_code == 429:
            raise HTTPException(status_code=429, detail="LLM rate limit exceeded") from exc
        raise HTTPException(status_code=502, detail="LLM provider request failed") from exc
    except APIError as exc:
        raise HTTPException(status_code=502, detail="LLM provider request failed") from exc

    suggestion = extract_text(response)
    if not suggestion:
        raise HTTPException(status_code=502, detail="LLM provider returned an empty response")

    return CompleteResponse(suggestion=suggestion)
