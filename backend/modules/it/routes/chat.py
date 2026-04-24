"""
Chat proxy routes — проксируют запросы к RocketChat REST API от имени текущего пользователя.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.auth import decode_token
from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db
from backend.modules.it.schemas.chat import (
    DmCreateRequest,
    DmCreateResponse,
    RcMessagesResponse,
    RcRoomsResponse,
    RcSubscription,
    SendMessageRequest,
)
from backend.modules.it.services.rocketchat_service import rocketchat_service
from backend.modules.it.services.ws_manager import ws_manager

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_rc_credentials(
    db: Session,
    current_user: User,
) -> tuple[str, str]:
    if not rocketchat_service._is_enabled(db):
        raise HTTPException(status_code=503, detail="RocketChat интеграция отключена")

    result = await rocketchat_service.get_or_create_user_token(db, current_user)
    if not result:
        raise HTTPException(
            status_code=403,
            detail="rc_login_required",
        )
    return result


class RcConnectRequest(BaseModel):
    username: str
    password: str


@router.post("/connect")
async def connect_with_password(
    body: RcConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Авторизация в RocketChat с логином и паролем пользователя."""
    if not rocketchat_service._is_enabled(db):
        raise HTTPException(status_code=503, detail="RocketChat интеграция отключена")

    result = await rocketchat_service.connect_user_with_password(
        db, current_user, body.username, body.password
    )
    if not result:
        raise HTTPException(status_code=400, detail="Неверный логин или пароль RocketChat")
    return {"success": True}


@router.get("/rooms", response_model=RcRoomsResponse)
async def get_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rc_user_id, rc_token = await _get_rc_credentials(db, current_user)
    rooms_raw = await rocketchat_service.proxy_get_rooms(db, rc_user_id, rc_token)
    rooms = [
        {
            "id": r["id"] or "",
            "name": r["name"] or "",
            "display_name": r["display_name"] or r["name"] or "",
            "type": r["type"] or "c",
            "unread": r.get("unread", 0),
            "alert": r.get("alert", False),
            "last_message": r.get("last_message"),
        }
        for r in rooms_raw
        if r.get("id")
    ]
    return {"rooms": rooms}


@router.get("/rooms/{room_id}/messages", response_model=RcMessagesResponse)
async def get_messages(
    room_id: str,
    room_type: str = Query("c", description="Тип комнаты: c, p, d"),
    count: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rc_user_id, rc_token = await _get_rc_credentials(db, current_user)
    data = await rocketchat_service.proxy_get_messages(
        db, rc_user_id, rc_token, room_id, room_type, count, offset
    )
    messages = [
        {
            "id": m["id"] or "",
            "room_id": room_id,
            "text": m.get("text", ""),
            "sender_name": m.get("sender_name", ""),
            "sender_username": m.get("sender_username", ""),
            "ts": m.get("ts"),
            "attachments": m.get("attachments", []),
            "t": m.get("t"),
        }
        for m in data["messages"]
        if m.get("id")
    ]
    return {"messages": messages, "total": data["total"]}


@router.post("/rooms/{room_id}/messages")
async def send_message(
    room_id: str,
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rc_user_id, rc_token = await _get_rc_credentials(db, current_user)
    result = await rocketchat_service.proxy_send_message(
        db, rc_user_id, rc_token, room_id, body.text
    )
    if not result:
        raise HTTPException(status_code=502, detail="Не удалось отправить сообщение в RocketChat")
    return result


@router.get("/subscriptions", response_model=list[RcSubscription])
async def get_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rc_user_id, rc_token = await _get_rc_credentials(db, current_user)
    subs = await rocketchat_service.proxy_get_subscriptions(db, rc_user_id, rc_token)
    return subs


@router.post("/rooms/{room_id}/read")
async def mark_room_read(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rc_user_id, rc_token = await _get_rc_credentials(db, current_user)
    ok = await rocketchat_service.proxy_mark_read(db, rc_user_id, rc_token, room_id)
    return {"success": ok}


@router.get("/users")
async def get_chat_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Список активных сотрудников, сгруппированных по отделам."""
    from backend.modules.hr.models.employee import Employee
    from backend.modules.hr.models.department import Department
    from backend.modules.it.models import UserRcToken
    from backend.modules.hr.models.user import User as ElementsUser

    employees = (
        db.query(Employee)
        .filter(Employee.status.notin_(["fired", "dismissed", "archived"]))
        .order_by(Employee.full_name)
        .all()
    )

    # Маппинг email → реальный RC username (из user_rc_tokens через users)
    rc_username_by_email: dict[str, str] = {}
    tokens = (
        db.query(ElementsUser.email, UserRcToken.rc_user_id)
        .join(UserRcToken, UserRcToken.user_id == ElementsUser.id)
        .all()
    )
    for row in tokens:
        if row.email:
            # rc_user_id здесь — ID, не username; username = email prefix как мы задаём
            rc_username_by_email[row.email] = row.email.split("@")[0]

    dept_map: dict[int, dict] = {}
    no_dept: list[dict] = []

    for emp in employees:
        if not emp.email:
            continue
        rc_username = rc_username_by_email.get(emp.email) or emp.email.split("@")[0]
        user_data = {
            "full_name": emp.full_name,
            "email": emp.email,
            "rc_username": rc_username,
        }
        if emp.department_id and emp.department:
            did = emp.department_id
            if did not in dept_map:
                dept_map[did] = {"id": did, "name": emp.department.name, "users": []}
            dept_map[did]["users"].append(user_data)
        else:
            no_dept.append(user_data)

    departments = sorted(dept_map.values(), key=lambda d: d["name"])
    return {"departments": departments, "without_department": no_dept}


@router.post("/dm", response_model=DmCreateResponse)
async def create_dm(
    body: DmCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Открыть или создать DM-комнату с пользователем RC."""
    rc_user_id, rc_token = await _get_rc_credentials(db, current_user)
    result = await rocketchat_service.proxy_create_dm(db, rc_user_id, rc_token, body.rc_username)
    if not result:
        raise HTTPException(status_code=502, detail="Не удалось открыть переписку")
    return result


@router.websocket("/ws")
async def chat_websocket(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket для real-time push новых сообщений из RocketChat в браузер."""
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=4001)
        return

    user_id = UUID(payload["sub"])
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
