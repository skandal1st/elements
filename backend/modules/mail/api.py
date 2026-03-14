import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List

from backend.core.auth import get_token_payload
from backend.core.database import get_db
from backend.modules.mail.models import MailAccount
from backend.modules.mail.schemas import (
    MailAccountCreate,
    MailAccountResponse,
    MailAccountUpdate,
    MailFolderResponse,
    MailMessageDetailResponse,
    MailMessageResponse,
    MailSendRequest,
)
from backend.modules.mail.services import (
    archive_by_uid_async,
    delete_by_uid_async,
    fetch_attachment_by_index_async,
    fetch_emails_async,
    fetch_message_by_uid_async,
    get_inbox_unread_count_async,
    list_folders_async,
    send_email_async,
    set_seen_by_uid_async,
)

router = APIRouter(prefix="/api/v1/mail", tags=["mail"])


def _user_id_from_payload(payload: dict) -> UUID:
    """Извлекает user_id (UUID) из JWT payload для надёжного поиска учётной записи в БД."""
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Токен не содержит идентификатора пользователя")
    try:
        return UUID(str(sub))
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=401, detail="Неверный формат идентификатора пользователя") from e


@router.post("/accounts", response_model=MailAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_mail_account(
    account_in: MailAccountCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Создать или обновить учетную запись почты для текущего пользователя (сохраняется в БД)."""
    user_id = _user_id_from_payload(payload)
    data = account_in.model_dump()
    existing = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if existing:
        for key, value in data.items():
            if key == "password" and not (value or "").strip():
                continue
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    if not (data.get("password") or "").strip():
        raise HTTPException(status_code=400, detail="Пароль обязателен при создании учётной записи")
    new_account = MailAccount(user_id=user_id, **data)
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account


@router.get("/accounts/me", response_model=MailAccountResponse)
async def get_my_mail_account(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Получить настройки почты текущего пользователя из БД."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Учетная запись не настроена")
    return account


@router.get("/unread-count")
async def get_unread_count(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Количество непрочитанных писем в папке Входящие (для бейджа в сайдбаре)."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        return {"unread_count": 0}
    count = await get_inbox_unread_count_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
    )
    return {"unread_count": count}


@router.get("/folders", response_model=List[MailFolderResponse])
async def get_folders(
    include_stats: bool = True,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Получить список папок почты с опциональными счётчиками total и unread."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")
    folders = await list_folders_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        include_stats=include_stats,
    )
    if not folders:
        return [MailFolderResponse(name="INBOX", display_name="Входящие")]
    return folders


@router.get("/inbox", response_model=List[MailMessageResponse])
async def get_inbox_messages(
    folder: str = "INBOX",
    limit: int = 50,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Получить письма из указанной папки через IMAP (folder=INBOX по умолчанию)."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")
    emails = await fetch_emails_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        folder=folder,
        limit=limit,
    )
    
    result = []
    for email in emails:
        uid = email["uid"]
        result.append({
            "id": str(uid),
            "uid": uid,
            "subject": email["subject"] or "Без темы",
            "sender": email["sender"],
            "date": email["date"],
            "preview": email["preview"],
            "is_read": email["is_read"],
            "is_flagged": email["is_flagged"],
            "has_attachments": email["has_attachments"],
            "folder": email["folder"],
        })
    return result


@router.get("/inbox/{uid}", response_model=MailMessageDetailResponse)
async def get_inbox_message(
    uid: int,
    folder: str = "INBOX",
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Получить полное тело письма по IMAP UID из указанной папки (текст и HTML)."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")
    msg = await fetch_message_by_uid_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        uid=uid,
        folder=folder,
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Письмо не найдено")
    return msg


@router.get("/inbox/{uid}/attachments/{index}")
async def get_inbox_attachment(
    uid: int,
    index: int,
    folder: str = "INBOX",
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Скачать вложение по индексу (0, 1, 2, ...)."""
    if index < 0:
        raise HTTPException(status_code=400, detail="Неверный индекс вложения")
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")
    result = await fetch_attachment_by_index_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        uid=uid,
        folder=folder,
        index=index,
    )
    if not result:
        logging.getLogger(__name__).warning(
            "Attachment not found: uid=%s folder=%r index=%s", uid, folder, index
        )
        raise HTTPException(status_code=404, detail="Вложение не найдено")
    content, filename, content_type = result
    safe_name = filename.replace('"', "'").replace("\r", "").replace("\n", " ")
    # Заголовок Content-Type: только тип без параметров (charset и т.д.), без переносов
    safe_content_type = (content_type or "application/octet-stream").split(";")[0].strip().split("\n")[0].strip()
    if not safe_content_type:
        safe_content_type = "application/octet-stream"
    return Response(
        content=content,
        media_type=safe_content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Content-Length": str(len(content)),
        },
    )


@router.post("/inbox/{uid}/mark-read", status_code=status.HTTP_200_OK)
async def mark_inbox_message_read(
    uid: int,
    folder: str = "INBOX",
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Отметить письмо как прочитанное (установить флаг \\Seen в IMAP) в указанной папке."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")
    ok = await set_seen_by_uid_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        uid=uid,
        folder=folder,
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Не удалось установить флаг прочтения")
    return {"status": "ok"}


@router.post("/inbox/{uid}/archive", status_code=status.HTTP_200_OK)
async def archive_inbox_message(
    uid: int,
    folder: str = "INBOX",
    archive_folder: str = "Archive",
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Переместить письмо в папку Архив (COPY + помечаем удалённым в текущей папке)."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")
    ok = await archive_by_uid_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        uid=uid,
        folder=folder,
        archive_folder=archive_folder,
    )
    if not ok:
        raise HTTPException(
            status_code=502,
            detail="Не удалось переместить в архив. Проверьте, что папка «Архив» существует на сервере.",
        )
    return {"status": "ok"}


@router.post("/inbox/{uid}/delete", status_code=status.HTTP_200_OK)
async def delete_inbox_message(
    uid: int,
    folder: str = "INBOX",
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Удалить письмо (пометить \\Deleted и выполнить EXPUNGE)."""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")
    ok = await delete_by_uid_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        uid=uid,
        folder=folder,
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Не удалось удалить письмо")
    return {"status": "ok"}


@router.post("/send", status_code=status.HTTP_200_OK)
async def send_new_email(
    request: MailSendRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """Отправить новое письмо"""
    user_id = _user_id_from_payload(payload)
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")

    try:
        await send_email_async(
            host=account.smtp_host,
            port=account.smtp_port,
            login=account.login,
            password=account.password,
            ssl=account.smtp_ssl,
            to_email=request.to_email,
            subject=request.subject,
            text_body=request.text_body,
            html_body=request.html_body
        )
        return {"status": "ok", "message": "Письмо отправлено"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отправки письма: {str(e)}")
