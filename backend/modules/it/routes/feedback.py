"""
Публичные endpoints для обратной связи по тикетам (без авторизации).
Используются в email-уведомлениях: кнопка "Вернуть в работу" и оценка 👍/👎.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.modules.it.models import Ticket

router = APIRouter(prefix="/feedback", tags=["it-feedback"])


def _html_response(title: str, message: str, color: str = "#10b981") -> HTMLResponse:
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }}
    .card {{
      background: #fff;
      border-radius: 12px;
      padding: 48px 40px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }}
    .icon {{
      font-size: 56px;
      margin-bottom: 16px;
    }}
    h1 {{
      margin: 0 0 12px;
      font-size: 22px;
      color: #111827;
    }}
    p {{
      margin: 0;
      font-size: 15px;
      color: #6b7280;
      line-height: 1.6;
    }}
    .badge {{
      display: inline-block;
      margin-top: 20px;
      background: {color};
      color: #fff;
      border-radius: 20px;
      padding: 6px 18px;
      font-size: 13px;
      font-weight: 500;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>{title}</h1>
    <p>{message}</p>
    <div class="badge">Elements IT</div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)


def _html_error(message: str) -> HTMLResponse:
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ошибка</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }}
    .card {{
      background: #fff;
      border-radius: 12px;
      padding: 48px 40px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }}
    .icon {{ font-size: 56px; margin-bottom: 16px; }}
    h1 {{ margin: 0 0 12px; font-size: 22px; color: #111827; }}
    p {{ margin: 0; font-size: 15px; color: #6b7280; line-height: 1.6; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Ссылка недействительна</h1>
    <p>{message}</p>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html, status_code=400)


@router.get("/{token}/reopen", response_class=HTMLResponse)
async def reopen_ticket(token: str, db: Session = Depends(get_db)):
    """Вернуть тикет в работу (без авторизации, по токену из письма)."""
    ticket = db.query(Ticket).filter(Ticket.feedback_token == token).first()
    if not ticket:
        return _html_error("Ссылка устарела или недействительна.")

    if ticket.status not in ("resolved", "closed"):
        return _html_response(
            "Заявка уже в работе",
            f"Заявка «{ticket.title}» уже имеет статус, не требующий возврата.",
            "#f59e0b",
        )

    ticket.status = "in_progress"
    ticket.resolved_at = None
    db.commit()

    return _html_response(
        "Заявка возвращена в работу",
        f"Заявка «{ticket.title}» (#{str(ticket.id)[:8]}) успешно возвращена в работу. "
        "Специалист свяжется с вами в ближайшее время.",
        "#f59e0b",
    )


@router.get("/{token}/rate/{direction}", response_class=HTMLResponse)
async def rate_ticket(token: str, direction: str, db: Session = Depends(get_db)):
    """Оценить работу специалиста (👍 up / 👎 down)."""
    if direction not in ("up", "down"):
        return _html_error("Некорректная оценка.")

    ticket = db.query(Ticket).filter(Ticket.feedback_token == token).first()
    if not ticket:
        return _html_error("Ссылка устарела или недействительна.")

    ticket.rating = 5 if direction == "up" else 1
    db.commit()

    if direction == "up":
        return _html_response(
            "Спасибо за оценку! 👍",
            f"Вы отметили работу специалиста по заявке «{ticket.title}» как хорошую. "
            "Ваш отзыв поможет нам становиться лучше.",
            "#10b981",
        )
    return _html_response(
        "Спасибо за оценку! 👎",
        f"Вы отметили работу специалиста по заявке «{ticket.title}» как неудовлетворительную. "
        "Мы разберёмся и постараемся улучшить качество обслуживания.",
        "#ef4444",
    )
