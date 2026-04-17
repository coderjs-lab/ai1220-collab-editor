import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from httpx import ASGITransport, AsyncClient

from main import SYSTEM_PROMPT, app


class FakeResponse:
    def __init__(self, text: str) -> None:
        self.content = [{"type": "text", "text": text}]


class FakeMessages:
    def __init__(self, text: str) -> None:
        self._text = text
        self.last_call = None

    def create(self, **kwargs):
        self.last_call = kwargs
        return FakeResponse(self._text)


class FakeAnthropic:
    def __init__(self, text: str) -> None:
        self.messages = FakeMessages(text)


def request(method: str, path: str, json=None):
    async def _run():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, path, json=json)

    return asyncio.run(_run())


def clear_client_state() -> None:
    if hasattr(app.state, "anthropic"):
        delattr(app.state, "anthropic")


def test_health() -> None:
    clear_client_state()
    response = request("GET", "/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_complete_with_context() -> None:
    clear_client_state()
    fake_client = FakeAnthropic("Formal rewrite")
    app.state.anthropic = fake_client

    response = request(
        "POST",
        "/complete",
        json={
            "prompt": "Rewrite this in a formal tone.",
            "document_context": "Original draft text.",
            "scope": "document",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"suggestion": "Formal rewrite"}

    call = fake_client.messages.last_call
    assert call["system"] == SYSTEM_PROMPT
    assert call["messages"][0]["role"] == "user"
    assert "Document context:" in call["messages"][0]["content"]
    assert "Original draft text." in call["messages"][0]["content"]
    assert "Rewrite this in a formal tone." in call["messages"][0]["content"]


def test_complete_without_context() -> None:
    clear_client_state()
    fake_client = FakeAnthropic("Summary output")
    app.state.anthropic = fake_client

    response = request(
        "POST",
        "/complete",
        json={
            "prompt": "Summarize this text.",
            "scope": "selection",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"suggestion": "Summary output"}

    call = fake_client.messages.last_call
    assert call["messages"][0]["content"] == "Summarize this text."


def test_complete_missing_prompt_returns_400() -> None:
    clear_client_state()
    response = request("POST", "/complete", json={})

    assert response.status_code == 400
    assert response.json() == {"detail": "prompt is required"}
