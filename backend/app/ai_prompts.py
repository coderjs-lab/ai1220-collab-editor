from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any

from .content import coerce_content, content_to_plain_text


FEATURES = ("rewrite", "summarize", "expand", "fix_grammar", "custom")
REWRITE_TONES = ("professional", "friendly", "confident", "concise")
SUMMARY_LENGTHS = ("short", "medium", "long")
SUMMARY_FORMATS = ("paragraph", "bullets")

SYSTEM_PROMPTS: dict[str, str] = {
    "rewrite": (
        "You are Draftboard's AI writing assistant. Rewrite the provided text while preserving the "
        "meaning, keeping the output ready to paste directly into a document without extra framing."
    ),
    "summarize": (
        "You are Draftboard's AI writing assistant. Summarize the provided material accurately, "
        "without inventing facts, and return only the summary content."
    ),
    "expand": (
        "You are Draftboard's AI writing assistant. Expand the provided material with concrete, "
        "coherent detail while preserving the existing meaning and structure."
    ),
    "fix_grammar": (
        "You are Draftboard's AI writing assistant. Correct grammar, spelling, punctuation, and "
        "clarity issues while preserving the author's intent."
    ),
    "custom": (
        "You are Draftboard's AI writing assistant. Follow the user's instruction closely and "
        "return only document-ready content."
    ),
}

PROMPT_MODULE: dict[str, str] = {
    "rewrite": (
        "Task: Rewrite the source text in a {tone} tone.\n"
        "Extra instruction: {instruction}\n\n"
        "Context scope: {context_scope}\n"
        "Document title: {title}\n"
        "Source text:\n{context_preview}\n"
    ),
    "summarize": (
        "Task: Summarize the material as a {summary_length} {summary_format}.\n"
        "Extra instruction: {instruction}\n\n"
        "Context scope: {context_scope}\n"
        "Document title: {title}\n"
        "Material:\n{context_preview}\n"
    ),
    "expand": (
        "Task: Expand the source text with more detail and supporting explanation.\n"
        "Extra instruction: {instruction}\n\n"
        "Context scope: {context_scope}\n"
        "Document title: {title}\n"
        "Source text:\n{context_preview}\n"
    ),
    "fix_grammar": (
        "Task: Correct grammar, spelling, punctuation, and awkward phrasing.\n"
        "Extra instruction: {instruction}\n\n"
        "Context scope: {context_scope}\n"
        "Document title: {title}\n"
        "Source text:\n{context_preview}\n"
    ),
    "custom": (
        "Task: {instruction}\n\n"
        "Context scope: {context_scope}\n"
        "Document title: {title}\n"
        "Relevant document context:\n{context_preview}\n"
    ),
}


@dataclass(frozen=True)
class ResolvedPromptPackage:
    feature: str
    context_scope: str
    context_preview: str
    system_prompt: str
    user_prompt: str
    resolved_prompt: str


def _normalize_whitespace(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _truncate(value: str, limit: int) -> str:
    normalized = value.strip()
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: max(0, limit - 1)].rstrip()}…"


def _extract_headings(content: Any) -> list[str]:
    headings: list[str] = []

    def walk(node: Any) -> None:
        if not isinstance(node, dict):
            return

        if node.get("type") == "heading":
            text = content_to_plain_text({"type": "doc", "content": [node]}).strip()
            if text:
                headings.append(text)

        for child in node.get("content", []) or []:
            walk(child)

    walk(coerce_content(content))
    return headings


def _find_section_excerpt(plain_text: str, selection_text: str) -> str:
    normalized_selection = selection_text.strip()
    source = plain_text.strip()
    if not source:
        return ""

    if not normalized_selection:
        return _truncate(source, 1400)

    index = source.lower().find(normalized_selection.lower())
    if index < 0:
        return _truncate(source, 1400)

    radius = 700
    start = max(0, index - radius)
    end = min(len(source), index + len(normalized_selection) + radius)
    return _truncate(source[start:end], 1400)


def _build_document_context(title: str, plain_text: str, headings: list[str], selection_text: str) -> str:
    sections: list[str] = []
    if title.strip():
        sections.append(f"Title: {title.strip()}")
    if headings:
        sections.append("Outline:\n- " + "\n- ".join(headings[:8]))

    if selection_text.strip():
        sections.append(f"Selected excerpt:\n{_truncate(selection_text, 700)}")

    if plain_text.strip():
        sections.append(f"Document excerpt:\n{_truncate(plain_text, 1700)}")

    return "\n\n".join(section for section in sections if section).strip()


def resolve_context_preview(
    title: str,
    content: Any,
    requested_scope: str | None,
    selected_text: str | None,
) -> tuple[str, str]:
    plain_text = content_to_plain_text(content)
    headings = _extract_headings(content)
    selection = _normalize_whitespace(selected_text)

    if requested_scope in {"selection", "section", "document"}:
        scope = requested_scope
    elif selection and len(selection.split()) < 200:
        scope = "selection"
    elif len(plain_text.split()) > 4000:
        scope = "document"
    else:
        scope = "section"

    if scope == "selection":
        context_preview = _truncate(selection or plain_text, 900)
    elif scope == "section":
        context_preview = _find_section_excerpt(plain_text, selection)
    else:
        context_preview = _build_document_context(title, plain_text, headings, selection)

    return scope, context_preview or "Document is empty."


def _feature_instruction(
    *,
    feature: str,
    prompt: str | None,
    tone: str | None,
    summary_length: str | None,
    summary_format: str | None,
) -> str:
    if feature == "rewrite":
        return _normalize_whitespace(prompt) or f"Keep the rewrite {tone or 'professional'} and document-ready."
    if feature == "summarize":
        return _normalize_whitespace(prompt) or (
            f"Summarize the content as a {summary_length or 'short'} {summary_format or 'paragraph'}."
        )
    if feature == "expand":
        return _normalize_whitespace(prompt) or "Expand the text with more detail while preserving meaning."
    if feature == "fix_grammar":
        return _normalize_whitespace(prompt) or "Correct grammar, spelling, punctuation, and awkward phrasing."
    return _normalize_whitespace(prompt)


def build_prompt_package(
    *,
    title: str,
    content: Any,
    feature: str,
    prompt: str | None,
    requested_scope: str | None,
    selected_text: str | None,
    tone: str | None,
    summary_length: str | None,
    summary_format: str | None,
) -> ResolvedPromptPackage:
    normalized_feature = feature if feature in FEATURES else "custom"
    scope, context_preview = resolve_context_preview(title, content, requested_scope, selected_text)
    instruction = _feature_instruction(
        feature=normalized_feature,
        prompt=prompt,
        tone=tone,
        summary_length=summary_length,
        summary_format=summary_format,
    )
    if normalized_feature == "custom" and not instruction:
        instruction = "Provide a helpful document-ready suggestion."

    template = PROMPT_MODULE[normalized_feature]
    user_prompt = template.format(
        tone=tone or "professional",
        summary_length=summary_length or "short",
        summary_format=summary_format or "paragraph",
        instruction=instruction,
        context_scope=scope,
        title=title.strip() or "Untitled",
        context_preview=context_preview,
    ).strip()
    system_prompt = SYSTEM_PROMPTS[normalized_feature]
    resolved_prompt = f"SYSTEM:\n{system_prompt}\n\nUSER:\n{user_prompt}"

    return ResolvedPromptPackage(
        feature=normalized_feature,
        context_scope=scope,
        context_preview=context_preview,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        resolved_prompt=resolved_prompt,
    )
