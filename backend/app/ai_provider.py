from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
import re
from typing import Protocol


class AiProvider(Protocol):
    async def stream_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str,
        max_output_tokens: int,
        feature: str,
        context_preview: str,
    ) -> AsyncIterator[str]: ...


def _normalize_sentences(value: str) -> list[str]:
    raw = re.split(r"(?<=[.!?])\s+", value.strip())
    return [sentence.strip() for sentence in raw if sentence.strip()]


def _normalize_prose(value: str) -> str:
    compact = re.sub(r"\s+", " ", value).strip()
    if not compact:
        return ""
    compact = compact[0].upper() + compact[1:]
    if compact[-1] not in ".!?":
        compact = f"{compact}."
    return compact


def _compress_text(value: str) -> str:
    compressed = re.sub(r"\b(really|very|quite|just|actually)\b", "", value, flags=re.IGNORECASE)
    compressed = re.sub(r"\s{2,}", " ", compressed)
    return _normalize_prose(compressed)


def _professionalize(value: str) -> str:
    replacements = {
        "can't": "cannot",
        "won't": "will not",
        "don't": "do not",
        "it's": "it is",
        "i'm": "I am",
    }
    normalized = value
    for needle, replacement in replacements.items():
        normalized = re.sub(rf"\b{re.escape(needle)}\b", replacement, normalized, flags=re.IGNORECASE)
    return _normalize_prose(normalized)


def _friendly_rewrite(value: str) -> str:
    normalized = _normalize_prose(value)
    if not normalized:
        return normalized
    return normalized.replace("Therefore", "So").replace("However", "Still")


def _summarize(value: str, *, as_bullets: bool, length: str) -> str:
    sentences = _normalize_sentences(value)
    if not sentences:
        return "No document text was available to summarize."

    take = 1 if length == "short" else 2 if length == "medium" else 3
    selected = sentences[:take]
    if as_bullets:
        return "\n".join(f"- {sentence.rstrip('.')}." for sentence in selected)
    return " ".join(selected)


def _expand(value: str) -> str:
    normalized = _normalize_prose(value)
    if not normalized:
        return "Add a concrete example, note the expected outcome, and clarify the next action."
    return (
        f"{normalized} This version adds more operational detail, clarifies the intent, "
        "and gives the reader a clearer sense of what should happen next."
    )


def _fix_grammar(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    normalized = normalized.replace(" ,", ",").replace(" .", ".")
    return _normalize_prose(normalized)


def _custom_response(context_preview: str, user_prompt: str) -> str:
    base = _normalize_prose(context_preview)
    if not base:
        return "Provide source text or a clearer instruction so the assistant can generate a document-ready revision."
    instruction_line = user_prompt.splitlines()[0].replace("Task:", "").strip()
    if instruction_line:
        return f"{base}\n\nAdjusted to satisfy this instruction: {instruction_line}"
    return base


def build_stub_suggestion(*, feature: str, context_preview: str, user_prompt: str) -> str:
    if feature == "summarize":
        as_bullets = "bullets" in user_prompt.lower()
        if "long" in user_prompt.lower():
            length = "long"
        elif "medium" in user_prompt.lower():
            length = "medium"
        else:
            length = "short"
        return _summarize(context_preview, as_bullets=as_bullets, length=length)

    if feature == "rewrite":
        if "friendly" in user_prompt.lower():
            return _friendly_rewrite(context_preview)
        if "concise" in user_prompt.lower():
            return _compress_text(context_preview)
        return _professionalize(context_preview)

    if feature == "expand":
        return _expand(context_preview)

    if feature == "fix_grammar":
        return _fix_grammar(context_preview)

    return _custom_response(context_preview, user_prompt)


class StubAiProvider:
    async def stream_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str,
        max_output_tokens: int,
        feature: str,
        context_preview: str,
    ) -> AsyncIterator[str]:
        suggestion = build_stub_suggestion(
            feature=feature,
            context_preview=context_preview,
            user_prompt=user_prompt,
        )
        words = suggestion.split()
        for index, word in enumerate(words):
            yield word + (" " if index < len(words) - 1 else "")
            await asyncio.sleep(0)


class AnthropicAiProvider:
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        try:
            from anthropic import AsyncAnthropic
        except ImportError as exc:
            raise RuntimeError(
                "Anthropic provider is configured but the 'anthropic' package is not installed."
            ) from exc

        self._client = AsyncAnthropic(api_key=self._api_key)
        return self._client

    async def stream_text(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str,
        max_output_tokens: int,
        feature: str,
        context_preview: str,
    ) -> AsyncIterator[str]:
        client = self._get_client()
        try:
            async with client.messages.stream(
                model=model,
                max_tokens=max_output_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    if text:
                        yield text
        except Exception as exc:
            raise RuntimeError("The Anthropic provider could not complete the request.") from exc

