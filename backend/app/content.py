from __future__ import annotations

import json
from typing import Any


RichTextContent = dict[str, Any]


def default_content() -> RichTextContent:
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
            }
        ],
    }


def plain_text_to_content(text: str) -> RichTextContent:
    stripped = text.strip("\n")
    if not stripped:
        return default_content()

    paragraphs = []
    for paragraph in stripped.split("\n\n"):
        lines = [line for line in paragraph.splitlines() if line]
        text_value = "\n".join(lines).strip()
        paragraphs.append(
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text_value}] if text_value else [],
            }
        )

    return {"type": "doc", "content": paragraphs or default_content()["content"]}


def coerce_content(raw: Any) -> RichTextContent:
    if raw is None:
        return default_content()

    if isinstance(raw, dict):
        return raw if raw.get("type") == "doc" else default_content()

    if isinstance(raw, str):
        candidate = raw.strip()
        if not candidate:
            return default_content()

        if candidate.startswith("{"):
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict) and parsed.get("type") == "doc":
                    return parsed
            except json.JSONDecodeError:
                pass

        return plain_text_to_content(candidate)

    return default_content()


def serialize_content(content: RichTextContent) -> str:
    return json.dumps(coerce_content(content), separators=(",", ":"), ensure_ascii=False)


def content_to_plain_text(content: Any) -> str:
    parsed = coerce_content(content)
    lines: list[str] = []

    def walk(node: Any) -> None:
        if not isinstance(node, dict):
            return

        if node.get("type") == "text":
            lines.append(str(node.get("text", "")))
            return

        if node.get("type") in {"paragraph", "heading", "codeBlock", "blockquote", "listItem"}:
            if lines and lines[-1] != "\n":
                lines.append("\n")

        for child in node.get("content", []) or []:
            walk(child)

        if node.get("type") in {"paragraph", "heading", "codeBlock", "blockquote", "listItem"}:
            if not lines or lines[-1] != "\n":
                lines.append("\n")

    walk(parsed)
    plain = "".join(lines).strip()
    return plain

