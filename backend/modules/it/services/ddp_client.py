"""
DDP (Distributed Data Protocol) WebSocket клиент для RocketChat.

Подключается к wss://rc-domain/websocket от имени бота, подписывается на
stream-room-messages (__my_messages__) и транслирует новые сообщения в ws_manager.
"""

import asyncio
import json
import logging
from typing import Any, Callable, Awaitable, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

# Тип колбэка: (room_id, message_dict) -> None
MessageCallback = Callable[[str, dict], Awaitable[None]]


class DDPClient:
    """Низкоуровневый DDP WebSocket клиент."""

    CONNECT_TIMEOUT = 10.0
    PING_INTERVAL = 25  # секунд

    def __init__(self, url: str, bot_user_id: str, bot_token: str):
        self._url = url  # wss://rc/websocket
        self._bot_user_id = bot_user_id
        self._bot_token = bot_token

        self._ws = None
        self._session_id: Optional[str] = None
        self._pending: dict[str, asyncio.Future] = {}  # id -> Future
        self._subs: dict[str, dict] = {}  # sub_id -> {name, params}
        self._msg_callback: Optional[MessageCallback] = None
        self._connected = False

    def set_message_callback(self, cb: MessageCallback) -> None:
        self._msg_callback = cb

    async def connect_and_login(self) -> bool:
        """Открыть соединение, выполнить DDP handshake и логин."""
        try:
            import websockets  # noqa: WPS433
            self._ws = await asyncio.wait_for(
                websockets.connect(
                    self._url,
                    ping_interval=None,  # управляем пингами вручную
                    max_size=10 * 1024 * 1024,
                ),
                timeout=self.CONNECT_TIMEOUT,
            )
        except Exception as e:
            logger.error(f"[DDP] Ошибка подключения к {self._url}: {e}")
            return False

        # DDP connect handshake
        await self._send({"msg": "connect", "version": "1", "support": ["1"]})
        try:
            msg = await asyncio.wait_for(self._recv(), timeout=10.0)
        except asyncio.TimeoutError:
            logger.error("[DDP] Таймаут ожидания connected")
            return False

        if msg.get("msg") != "connected":
            logger.error(f"[DDP] Ожидали connected, получили: {msg}")
            return False

        self._session_id = msg.get("session")
        logger.info(f"[DDP] Подключён, session={self._session_id}")

        # Логин через resume token.
        # Нельзя использовать _call() — listen() ещё не запущен, некому читать ответ.
        # Читаем ответ вручную в цикле (RC может прислать ping до result).
        call_id = str(uuid4())
        await self._send({
            "msg": "method",
            "method": "login",
            "id": call_id,
            "params": [{"resume": self._bot_token}],
        })

        loop = asyncio.get_event_loop()
        deadline = loop.time() + 15.0
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                logger.error("[DDP] Таймаут ожидания результата логина")
                return False
            try:
                reply = await asyncio.wait_for(self._recv(), timeout=remaining)
            except asyncio.TimeoutError:
                logger.error("[DDP] Таймаут ожидания результата логина")
                return False

            if reply.get("msg") == "ping":
                await self._send({"msg": "pong"})
                continue

            if reply.get("msg") == "result" and reply.get("id") == call_id:
                err = reply.get("error")
                if err:
                    logger.error(f"[DDP] Ошибка логина: {err}")
                    return False
                break

        self._connected = True
        logger.info("[DDP] Логин успешен")
        return True

    async def subscribe_my_messages(self) -> str:
        """Подписка на все сообщения бота (все доступные комнаты)."""
        sub_id = str(uuid4())
        # Стандартный формат RC DDP для подписки на все комнаты бота
        params = ["__my_messages__", False]
        await self._send({
            "msg": "sub",
            "id": sub_id,
            "name": "stream-room-messages",
            "params": params,
        })
        self._subs[sub_id] = {"name": "stream-room-messages", "params": params}
        logger.info(f"[DDP] Подписка stream-room-messages, sub_id={sub_id}")
        return sub_id

    async def resubscribe_all(self) -> None:
        """Восстановить все подписки после переподключения."""
        for sub_id, sub in list(self._subs.items()):
            await self._send({
                "msg": "sub",
                "id": sub_id,
                "name": sub["name"],
                "params": sub["params"],
            })
        logger.info(f"[DDP] Восстановлено {len(self._subs)} подписок")

    async def listen(self) -> None:
        """Основной цикл чтения сообщений. Блокирует до разрыва соединения."""
        while True:
            try:
                msg = await self._recv()
            except Exception:
                break

            msg_type = msg.get("msg")

            if msg_type == "ping":
                await self._send({"msg": "pong"})

            elif msg_type == "changed" and msg.get("collection") == "stream-room-messages":
                await self._dispatch_message(msg)

            elif msg_type == "result":
                fut = self._pending.pop(msg.get("id", ""), None)
                if fut and not fut.done():
                    fut.set_result(msg.get("result") or msg)

            elif msg_type == "error":
                logger.warning(f"[DDP] Ошибка от сервера: {msg}")

    async def ping_loop(self) -> None:
        """Периодические ping для поддержания соединения."""
        while self._connected:
            await asyncio.sleep(self.PING_INTERVAL)
            try:
                await self._send({"msg": "ping"})
            except Exception:
                break

    async def close(self) -> None:
        self._connected = False
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

    # ── helpers ──────────────────────────────────────────────

    async def _send(self, data: dict) -> None:
        if self._ws:
            await self._ws.send(json.dumps(data))

    async def _recv(self) -> dict:
        raw = await self._ws.recv()
        return json.loads(raw)

    async def _call(self, method: str, params: list, timeout: float = 10.0) -> Any:
        """Вызвать DDP метод и дождаться результата."""
        call_id = str(uuid4())
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[call_id] = fut

        await self._send({"msg": "method", "method": method, "id": call_id, "params": params})

        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(call_id, None)
            return None

    async def _dispatch_message(self, ddp_msg: dict) -> None:
        """Извлечь сообщение из DDP-события и вызвать колбэк."""
        if not self._msg_callback:
            return
        try:
            fields = ddp_msg.get("fields", {})
            args = fields.get("args", [])
            logger.debug(f"[DDP] dispatch: eventName={fields.get('eventName')} args_len={len(args)}")
            if not args:
                return
            rc_msg = args[0]
            room_id = rc_msg.get("rid") or fields.get("eventName", "")
            if not room_id or "__my_messages__" in room_id:
                logger.debug(f"[DDP] пропускаем: room_id={room_id!r}")
                return
            logger.info(f"[DDP] новое сообщение: room={room_id} from={rc_msg.get('u', {}).get('username')!r} text={rc_msg.get('msg', '')[:50]!r}")
            await self._msg_callback(room_id, rc_msg)
        except Exception as e:
            logger.error(f"[DDP] Ошибка dispatch_message: {e}")


class RCRealtimeManager:
    """
    Синглтон. Управляет DDP-соединением с RC и рассылкой событий в ws_manager.
    Стартует при запуске приложения, переподключается при разрывах.
    """

    RECONNECT_DELAY = 5  # секунд

    def __init__(self):
        self._client: Optional[DDPClient] = None
        self._task: Optional[asyncio.Task] = None
        self._active = False

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._active = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("[RCRealtime] Менеджер запущен")

    async def stop(self) -> None:
        self._active = False
        if self._client:
            await self._client.close()
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[RCRealtime] Менеджер остановлен")

    async def _run_loop(self) -> None:
        """Внешний цикл: подключение → работа → переподключение при разрыве."""
        while self._active:
            try:
                await self._connect_and_run()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[RCRealtime] Критическая ошибка: {e}")

            if self._active:
                logger.info(f"[RCRealtime] Переподключение через {self.RECONNECT_DELAY}с...")
                await asyncio.sleep(self.RECONNECT_DELAY)

    async def _connect_and_run(self) -> None:
        from backend.core.database import SessionLocal
        from backend.modules.hr.models.system_settings import SystemSettings

        db = SessionLocal()
        try:
            def _get(key: str) -> Optional[str]:
                row = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                return row.setting_value if row else None

            enabled = (_get("rocketchat_enabled") or "").lower() == "true"
            if not enabled:
                logger.info("[RCRealtime] Интеграция отключена, ожидание...")
                await asyncio.sleep(30)
                return

            base_url = (_get("rocketchat_url") or "").rstrip("/")
            bot_user_id = _get("rocketchat_user_id") or ""
            bot_token = _get("rocketchat_auth_token") or ""

            if not base_url or not bot_user_id or not bot_token:
                logger.warning("[RCRealtime] Не заданы URL/user_id/token, ожидание...")
                await asyncio.sleep(30)
                return
        finally:
            db.close()

        # HTTP → ws, HTTPS → wss
        ws_url = base_url.replace("https://", "wss://").replace("http://", "ws://") + "/websocket"

        client = DDPClient(ws_url, bot_user_id, bot_token)
        client.set_message_callback(self._on_message)
        self._client = client

        if not await client.connect_and_login():
            await client.close()
            return

        await client.subscribe_my_messages()

        listen_task = asyncio.create_task(client.listen())
        ping_task = asyncio.create_task(client.ping_loop())

        try:
            done, pending = await asyncio.wait(
                {listen_task, ping_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()
        finally:
            await client.close()
            self._client = None

    async def _on_message(self, room_id: str, rc_msg: dict) -> None:
        """Принять сообщение от DDP и разослать подключённым WebSocket клиентам."""
        from backend.modules.it.services.ws_manager import ws_manager
        from backend.core.database import SessionLocal
        from backend.modules.hr.models.user import User
        from backend.modules.it.models import UserRcToken

        event = {
            "type": "new_message",
            "room_id": room_id,
            "message": {
                "id": rc_msg.get("_id", ""),
                "room_id": room_id,
                "text": rc_msg.get("msg", ""),
                "sender_name": rc_msg.get("u", {}).get("name", ""),
                "sender_username": rc_msg.get("u", {}).get("username", ""),
                "ts": rc_msg.get("ts", {}).get("$date") if isinstance(rc_msg.get("ts"), dict)
                      else rc_msg.get("ts"),
                "attachments": rc_msg.get("attachments", []),
            },
        }

        db = SessionLocal()
        try:
            user_ids = [row.user_id for row in db.query(UserRcToken.user_id).all()]
        finally:
            db.close()

        logger.info(f"[DDP] рассылка события room={room_id} → {len(user_ids)} пользователей, ws_active={ws_manager._total()}")
        for user_id in user_ids:
            await ws_manager.send_to_user(user_id, event)


rc_realtime_manager = RCRealtimeManager()
