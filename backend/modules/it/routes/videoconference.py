"""Роуты /it/videoconference — видеоконференции через Jitsi Meet."""

from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db
from backend.modules.it.models import Notification

router = APIRouter(prefix="/videoconference", tags=["videoconference"])


class VideoConferenceStartRequest(BaseModel):
    user_ids: List[UUID]


class VideoConferenceStartResponse(BaseModel):
    room_url: str
    room_id: str
    invited_count: int


@router.post("/start", response_model=VideoConferenceStartResponse)
async def start_videoconference(
    body: VideoConferenceStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создать видеоконференцию и уведомить участников."""
    if not body.user_ids:
        raise HTTPException(status_code=400, detail="Выберите хотя бы одного участника")

    room_id = uuid4()
    room_url = f"{settings.jitsi_base_url}/elements-{room_id}"

    # Убираем текущего пользователя из списка приглашённых
    invite_ids = [uid for uid in body.user_ids if uid != current_user.id]

    if not invite_ids:
        raise HTTPException(status_code=400, detail="Выберите хотя бы одного участника")

    # Проверяем, что пользователи существуют и активны
    users = (
        db.query(User)
        .filter(User.id.in_(invite_ids), User.is_active == True)
        .all()
    )

    if not users:
        raise HTTPException(status_code=400, detail="Не найдено активных пользователей")

    # Создаём уведомление для каждого участника
    for user in users:
        notif = Notification(
            user_id=user.id,
            title="Видеоконференция",
            message=f"{current_user.full_name} приглашает вас на видеоконференцию",
            type="info",
            related_type="videoconference",
            related_id=room_id,
        )
        db.add(notif)

    db.commit()

    return VideoConferenceStartResponse(
        room_url=room_url,
        room_id=str(room_id),
        invited_count=len(users),
    )
