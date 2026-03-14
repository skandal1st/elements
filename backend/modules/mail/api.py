from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.core.auth import get_token_payload
from backend.core.database import get_db
from backend.modules.mail.models import MailAccount
from backend.modules.mail.schemas import (
    MailAccountCreate,
    MailAccountResponse,
    MailAccountUpdate,
    MailMessageDetailResponse,
    MailMessageResponse,
    MailSendRequest,
)
from backend.modules.mail.services import (
    fetch_emails_async,
    fetch_message_by_uid_async,
    send_email_async,
    set_seen_by_uid_async,
)

router = APIRouter(prefix="/api/v1/mail", tags=["mail"])

@router.post("/accounts", response_model=MailAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_mail_account(
    account_in: MailAccountCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """Создать или обновить учетную запись почты для текущего пользователя"""
    user_id = payload.get("sub")
    
    # Check if exists
    existing = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if existing:
        for key, value in account_in.dict().items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing

    new_account = MailAccount(user_id=user_id, **account_in.dict())
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

@router.get("/accounts/me", response_model=MailAccountResponse)
async def get_my_mail_account(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """Получить настройки почты текущего пользователя"""
    user_id = payload.get("sub")
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Учетная запись не настроена")
    return account

@router.get("/inbox", response_model=List[MailMessageResponse])
async def get_inbox_messages(
    limit: int = 50,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """Получить последние письма через IMAP"""
    user_id = payload.get("sub")
    account = db.query(MailAccount).filter(MailAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=400, detail="Учетная запись почты не настроена")

    # Fetch directly using IMAP client
    emails = await fetch_emails_async(
        host=account.imap_host,
        port=account.imap_port,
        login=account.login,
        password=account.password,
        ssl=account.imap_ssl,
        limit=limit
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
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Получить полное тело письма по IMAP UID (текст и HTML)."""
    user_id = payload.get("sub")
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
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Письмо не найдено")
    return msg


@router.post("/inbox/{uid}/mark-read", status_code=status.HTTP_200_OK)
async def mark_inbox_message_read(
    uid: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """Отметить письмо как прочитанное (установить флаг \\Seen в IMAP)."""
    user_id = payload.get("sub")
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
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Не удалось установить флаг прочтения")
    return {"status": "ok"}

@router.post("/send", status_code=status.HTTP_200_OK)
async def send_new_email(
    request: MailSendRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """Отправить новое письмо"""
    user_id = payload.get("sub")
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
