"""Роуты /it/reports — отчеты."""
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case, extract, and_, or_
from sqlalchemy.orm import Session, aliased

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import Ticket
from backend.modules.hr.models.user import User


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/tickets")
def get_tickets_report(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    date_from: str = Query(..., description="Дата начала (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Дата окончания (YYYY-MM-DD)"),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
) -> dict:
    """Отчет по заявкам (только для admin/it_specialist)"""
    # Проверка прав доступа
    role = user.get_role("it") if not user.is_superuser else "admin"
    if role not in ("admin", "it_specialist"):
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    # Преобразуем даты
    try:
        date_from_start = datetime.strptime(date_from, "%Y-%m-%d").replace(hour=0, minute=0, second=0)
        date_to_end = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
    
    # Базовый запрос с фильтрами
    base_query = db.query(Ticket).filter(
        and_(
            Ticket.created_at >= date_from_start,
            Ticket.created_at <= date_to_end,
        )
    )
    
    if category:
        base_query = base_query.filter(Ticket.category == category)
    if priority:
        base_query = base_query.filter(Ticket.priority == priority)
    
    # 1. Сводная статистика
    summary_query = base_query.with_entities(
        func.count(Ticket.id).label("total_tickets"),
        func.count(case((Ticket.status.in_(["new", "in_progress", "waiting"]), 1))).label("open_tickets"),
        func.count(case((Ticket.status == "resolved", 1))).label("resolved_tickets"),
        func.count(case((Ticket.status == "closed", 1))).label("closed_tickets"),
        func.avg(
            case(
                (Ticket.resolved_at.isnot(None),
                 extract("epoch", Ticket.resolved_at - Ticket.created_at) / 3600),
                (Ticket.closed_at.isnot(None),
                 extract("epoch", Ticket.closed_at - Ticket.created_at) / 3600),
            )
        ).label("avg_resolution_time_hours"),
        func.avg(Ticket.rating).label("avg_rating"),
    )
    
    summary_result = summary_query.first()
    
    summary = {
        "total_tickets": summary_result.total_tickets or 0,
        "open_tickets": summary_result.open_tickets or 0,
        "resolved_tickets": summary_result.resolved_tickets or 0,
        "closed_tickets": summary_result.closed_tickets or 0,
        "avg_resolution_time_hours": float(summary_result.avg_resolution_time_hours) if summary_result.avg_resolution_time_hours else None,
        "avg_rating": float(summary_result.avg_rating) if summary_result.avg_rating else None,
    }
    
    # 2. Статистика по статусам
    by_status_query = base_query.with_entities(
        Ticket.status,
        func.count(Ticket.id).label("count")
    ).group_by(Ticket.status).order_by(func.count(Ticket.id).desc())
    
    by_status = [
        {"status": row.status, "count": row.count}
        for row in by_status_query.all()
    ]
    
    # 3. Статистика по категориям
    by_category_query = base_query.with_entities(
        Ticket.category,
        func.count(Ticket.id).label("count")
    ).group_by(Ticket.category).order_by(func.count(Ticket.id).desc())
    
    by_category = [
        {"category": row.category, "count": row.count}
        for row in by_category_query.all()
    ]
    
    # 4. Статистика по приоритетам
    priority_order = case(
        (Ticket.priority == "critical", 1),
        (Ticket.priority == "high", 2),
        (Ticket.priority == "medium", 3),
        (Ticket.priority == "low", 4),
    )
    
    by_priority_query = base_query.with_entities(
        Ticket.priority,
        func.count(Ticket.id).label("count")
    ).group_by(Ticket.priority).order_by(priority_order)
    
    by_priority = [
        {"priority": row.priority, "count": row.count}
        for row in by_priority_query.all()
    ]
    
    # 5. Детализация по срокам выполнения (первые 100)
    resolution_details_query = base_query.join(
        User, Ticket.creator_id == User.id, isouter=True
    ).with_entities(
        Ticket.id,
        Ticket.title,
        Ticket.category,
        Ticket.priority,
        Ticket.status,
        Ticket.created_at,
        Ticket.resolved_at,
        Ticket.closed_at,
        case(
            (Ticket.resolved_at.isnot(None),
             extract("epoch", Ticket.resolved_at - Ticket.created_at) / 3600),
            (Ticket.closed_at.isnot(None),
             extract("epoch", Ticket.closed_at - Ticket.created_at) / 3600),
        ).label("resolution_time_hours"),
        User.full_name.label("creator_name"),
    ).order_by(Ticket.created_at.desc()).limit(100)
    
    resolution_details = []
    for row in resolution_details_query.all():
        resolution_details.append({
            "id": str(row.id),
            "title": row.title,
            "category": row.category,
            "priority": row.priority,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
            "closed_at": row.closed_at.isoformat() if row.closed_at else None,
            "resolution_time_hours": float(row.resolution_time_hours) if row.resolution_time_hours else None,
            "creator_name": row.creator_name,
        })
    
    # 6. Топ пользователей по количеству заявок
    creator_alias = aliased(User)
    
    top_creators_query = db.query(
        creator_alias.id.label("user_id"),
        creator_alias.full_name.label("user_name"),
        creator_alias.email.label("user_email"),
        creator_alias.department,
        func.count(Ticket.id).label("ticket_count")
    ).join(
        Ticket, Ticket.creator_id == creator_alias.id
    ).filter(
        and_(
            Ticket.created_at >= date_from_start,
            Ticket.created_at <= date_to_end,
        )
    )
    
    if category:
        top_creators_query = top_creators_query.filter(Ticket.category == category)
    if priority:
        top_creators_query = top_creators_query.filter(Ticket.priority == priority)
    
    top_creators_query = top_creators_query.group_by(
        creator_alias.id, creator_alias.full_name, creator_alias.email, creator_alias.department
    ).order_by(func.count(Ticket.id).desc()).limit(10)
    
    top_creators = []
    for row in top_creators_query.all():
        top_creators.append({
            "user_id": str(row.user_id),
            "user_name": row.user_name,
            "user_email": row.user_email,
            "department": row.department,
            "ticket_count": row.ticket_count,
        })
    
    return {
        "data": {
            "summary": summary,
            "by_status": by_status,
            "by_category": by_category,
            "by_priority": by_priority,
            "resolution_details": resolution_details,
            "top_creators": top_creators,
        }
    }
