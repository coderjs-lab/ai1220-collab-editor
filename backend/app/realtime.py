from __future__ import annotations

import sqlite3
from typing import Any
from urllib.parse import parse_qs

import y_py as Y
from anyio import TASK_STATUS_IGNORED, create_task_group, sleep
from anyio.abc import TaskStatus
from fastapi import WebSocket, WebSocketDisconnect
from ypy_websocket import WebsocketServer, YRoom
from ypy_websocket.ystore import SQLiteYStore, YDocNotFound
from ypy_websocket.yutils import YMessageType, YSyncMessageType, process_sync_message, sync

from .config import settings


class CollaborationStore(SQLiteYStore):
    db_path = str(settings.ystore_path)


class CollaborationSocket:
    def __init__(self, websocket: WebSocket, path: str, metadata: dict[str, Any]):
        self._websocket = websocket
        self._path = path
        self.metadata = metadata

    @property
    def path(self) -> str:
        return self._path

    def __aiter__(self):
        return self

    async def __anext__(self) -> bytes:
        try:
            return await self.recv()
        except StopAsyncIteration as error:
            raise StopAsyncIteration() from error

    async def send(self, message: bytes) -> None:
        try:
            await self._websocket.send_bytes(message)
        except WebSocketDisconnect:
            return
        except RuntimeError:
            return

    async def recv(self) -> bytes:
        try:
            return await self._websocket.receive_bytes()
        except WebSocketDisconnect as error:
            raise StopAsyncIteration() from error


class CollaborationRoom(YRoom):
    def __init__(self, room_name: str, *, ystore: SQLiteYStore | None = None, log=None):
        super().__init__(ready=True, ystore=ystore, log=log)
        self.room_name = room_name
        self._loaded = False
        self._cleaned_up = False

    async def start(self, *, task_status: TaskStatus[None] = TASK_STATUS_IGNORED):
        if self.started.is_set():
            task_status.started()
            return

        if self._starting:
            await self.started.wait()
            task_status.started()
            return

        self._starting = True

        if self._task_group is not None:
            self._starting = False
            raise RuntimeError("YRoom already running")

        try:
            async with create_task_group() as self._task_group:
                if self.ystore is not None and not self.ystore.started.is_set():
                    await self._task_group.start(self.ystore.start)

                if self.ystore is not None and not self._loaded:
                    try:
                        async for update, _metadata, _timestamp in self.ystore.read():
                            if update:
                                Y.apply_update(self.ydoc, update)
                    except YDocNotFound:
                        pass
                    self._loaded = True

                self._task_group.start_soon(self._broadcast_updates)
                self.started.set()
                self._starting = False
                task_status.started()
        except BaseException:
            self._starting = False
            raise

    async def serve(self, websocket: CollaborationSocket):
        async with create_task_group() as task_group:
            self.clients.append(websocket)
            await sync(self.ydoc, websocket, self.log)
            try:
                async for message in websocket:
                    message_type = message[0]
                    sync_type = message[1] if len(message) > 1 else None

                    if (
                        websocket.metadata.get("role") == "viewer"
                        and message_type == YMessageType.SYNC
                        and sync_type == YSyncMessageType.SYNC_UPDATE
                    ):
                        continue

                    if message_type == YMessageType.SYNC:
                        task_group.start_soon(
                            process_sync_message, message[1:], self.ydoc, websocket, self.log
                        )
                    elif message_type == YMessageType.AWARENESS:
                        for client in self.clients:
                            task_group.start_soon(client.send, message)
            finally:
                self.clients = [client for client in self.clients if client != websocket]

    async def shutdown(self) -> None:
        if self._cleaned_up:
            return

        if self._task_group is not None:
            self.stop()
            await sleep(0)

        if self.ystore is not None and self.ystore._task_group is not None:
            self.ystore.stop()
            await sleep(0)

        self.clients.clear()
        self._on_message = None
        self._loaded = False

        self._update_send_stream.close()
        await self._update_receive_stream.aclose()

        # Drop Yjs state on the event-loop thread that created it so pytest
        # teardown does not end up finalizing the document from another thread.
        self.awareness = None
        self.ydoc = None
        self.ystore = None
        self._cleaned_up = True


class CollaborationServer(WebsocketServer):
    async def get_room(self, name: str) -> CollaborationRoom:
        if name not in self.rooms:
            self.rooms[name] = CollaborationRoom(
                name,
                ystore=CollaborationStore(path=name),
                log=self.log,
            )
        room = self.rooms[name]
        await self.start_room(room)
        return room

    async def delete_room_async(
        self, *, name: str | None = None, room: CollaborationRoom | None = None
    ) -> None:
        if name is not None and room is not None:
            raise RuntimeError("Cannot pass name and room")

        if name is None:
            assert room is not None
            name = self.get_room_name(room)

        room = self.rooms.pop(name)
        await room.shutdown()

    async def _serve(self, websocket: CollaborationSocket, tg):
        room = await self.get_room(websocket.path)
        await room.serve(websocket)

        if self.auto_clean_rooms and not room.clients:
            await self.delete_room_async(room=room)

        tg.cancel_scope.cancel()

    async def shutdown(self) -> None:
        for room_name in list(self.rooms.keys()):
            await self.delete_room_async(name=room_name)

        if self._task_group is not None:
            self.stop()
            await sleep(0)


def room_path(document_id: int) -> str:
    return f"/documents/{document_id}"


def token_from_query(websocket: WebSocket) -> str | None:
    query_bytes = websocket.scope.get("query_string", b"")
    params = parse_qs(query_bytes.decode("utf-8"))
    token_values = params.get("token", [])
    return token_values[0] if token_values else None


def build_socket(websocket: WebSocket, document_id: int, metadata: dict[str, Any]) -> CollaborationSocket:
    return CollaborationSocket(websocket, room_path(document_id), metadata)
