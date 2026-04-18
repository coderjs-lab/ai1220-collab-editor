from __future__ import annotations

from contextlib import asynccontextmanager
from anyio import create_task_group

from fastapi import FastAPI, HTTPException, WebSocket, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import create_connection, init_database
from . import repository
from .realtime import CollaborationServer, build_socket, token_from_query
from .routers import access, ai, auth, documents, sessions, share_links
from .schemas import HealthResponse
from .security import decode_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    collaboration_server = CollaborationServer()
    async with create_task_group() as task_group:
        await task_group.start(collaboration_server.start)
        app.state.collaboration_server = collaboration_server
        yield
        if collaboration_server.started.is_set():
            for room_name in list(collaboration_server.rooms.keys()):
                collaboration_server.delete_room(name=room_name)
            collaboration_server.stop()


app = FastAPI(
    title="Draftboard Backend",
    version="0.2.0",
    description="FastAPI collaboration foundation for Draftboard Assignment 2.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(_request, exc: RequestValidationError):
    first_error = exc.errors()[0] if exc.errors() else None
    if first_error and isinstance(first_error, dict):
        location = first_error.get("loc", [])
        field = location[-1] if location else "request"
        field_label = str(field).replace("_", " ").capitalize()
        message = first_error.get("msg", "Invalid request")
        detail = f"{field_label}: {message}"
    else:
        detail = "Invalid request"

    return JSONResponse(status_code=422, content={"error": detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request, _exc: Exception):
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(access.router)
app.include_router(share_links.router)
app.include_router(ai.router)
app.include_router(sessions.router)


@app.websocket("/ws/collab/{document_id}")
async def collab_socket(websocket: WebSocket, document_id: int):
    token = token_from_query(websocket)
    if not token:
        await websocket.close(code=1008, reason="Missing collaboration token")
        return

    try:
        payload = decode_token(token, expected_type="collab")
    except HTTPException:
        await websocket.close(code=1008, reason="Invalid collaboration token")
        return

    if int(payload.get("document_id", 0)) != document_id:
        await websocket.close(code=1008, reason="Document token mismatch")
        return

    connection = create_connection()
    try:
        document, role = repository.resolve_document_access(connection, document_id, int(payload["sub"]))
    finally:
        connection.close()

    if document is None or role is None:
        await websocket.close(code=1008, reason="Access denied")
        return

    await websocket.accept()
    socket = build_socket(
        websocket,
        document_id,
        {
            "user_id": int(payload["sub"]),
            "username": payload.get("username"),
            "role": role,
        },
    )
    await app.state.collaboration_server.serve(socket)
