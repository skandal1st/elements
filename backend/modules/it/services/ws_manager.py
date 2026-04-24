"""
Менеджер WebSocket соединений от браузеров/клиентов Elements.
Хранит активные соединения по user_id и рассылает им события.
"""

import json
import logging
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WSConnectionManager:
    def __init__(self):
        # user_id -> set of WebSocket (один пользователь может открыть несколько вкладок)
        self._connections: dict[UUID, set[WebSocket]] = {}

    async def connect(self, user_id: UUID, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(user_id, set()).add(ws)
        logger.info(f"[WS] Подключён user={user_id}, всего соединений: {self._total()}")

    def disconnect(self, user_id: UUID, ws: WebSocket) -> None:
        conns = self._connections.get(user_id)
        if conns:
            conns.discard(ws)
            if not conns:
                del self._connections[user_id]
        logger.debug(f"[WS] Отключён user={user_id}, всего соединений: {self._total()}")

    async def send_to_user(self, user_id: UUID, data: dict) -> None:
        conns = self._connections.get(user_id)
        if not conns:
            return
        dead = set()
        payload = json.dumps(data, default=str)
        for ws in list(conns):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    def _total(self) -> int:
        return sum(len(c) for c in self._connections.values())


ws_manager = WSConnectionManager()
