from __future__ import annotations

from backend.app.ai_prompts import build_prompt_package


def sample_content(text: str):
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


def test_build_prompt_package_uses_selection_context_when_requested():
    package = build_prompt_package(
        title="Design Notes",
        content=sample_content("Alpha beta gamma delta."),
        feature="rewrite",
        prompt="",
        requested_scope="selection",
        selected_text="beta gamma",
        tone="professional",
        summary_length=None,
        summary_format=None,
    )

    assert package.feature == "rewrite"
    assert package.context_scope == "selection"
    assert package.context_preview == "beta gamma"
    assert "beta gamma" in package.user_prompt
    assert "professional tone" in package.user_prompt


def test_build_prompt_package_switches_to_document_scope_for_long_documents():
    long_document = " ".join(f"word{i}" for i in range(4500))
    package = build_prompt_package(
        title="Long Report",
        content=sample_content(long_document),
        feature="summarize",
        prompt="",
        requested_scope=None,
        selected_text=None,
        tone=None,
        summary_length="short",
        summary_format="paragraph",
    )

    assert package.context_scope == "document"
    assert "Document excerpt:" in package.context_preview
    assert len(package.context_preview) <= 2000


def test_build_prompt_package_falls_back_to_default_custom_instruction():
    package = build_prompt_package(
        title="Untitled",
        content=sample_content("Original document text."),
        feature="custom",
        prompt="",
        requested_scope="section",
        selected_text=None,
        tone=None,
        summary_length=None,
        summary_format=None,
    )

    assert package.feature == "custom"
    assert "Provide a helpful document-ready suggestion." in package.user_prompt
    assert package.resolved_prompt.startswith("SYSTEM:\n")
