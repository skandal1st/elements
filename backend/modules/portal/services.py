"""
Сервис агрегации данных для стартовой страницы Portal
"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from backend.modules.hr.models.employee import Employee
from backend.modules.it.models import Ticket, Equipment
from backend.modules.hr.models.user import User
from backend.modules.portal.models import Announcement, CalendarEvent
from backend.modules.tasks.models import Task
from backend.modules.tasks.services.permissions import get_accessible_projects

class PortalService:
    """Сервис для агрегации данных портала"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_upcoming_birthdays(self, days_ahead: int = 7) -> List[Dict]:
        today = date.today()
        end_date = today + timedelta(days=days_ahead)
        
        employees = self.db.query(Employee).filter(
            Employee.birthday.isnot(None),
            Employee.status.in_(["active", "candidate", "hired"])
        ).all()
        
        birthdays = []
        for employee in employees:
            if not employee.birthday:
                continue
            
            birthday_this_year = employee.birthday.replace(year=today.year)
            
            if birthday_this_year < today:
                birthday_this_year = birthday_this_year.replace(year=today.year + 1)
            
            if today <= birthday_this_year <= end_date:
                days_left = (birthday_this_year - today).days
                birthdays.append({
                    "id": str(employee.id),
                    "name": employee.full_name,
                    "date": birthday_this_year.isoformat(),
                    "days_left": days_left,
                    "department": employee.department.name if employee.department else None,
                })
        
        birthdays.sort(key=lambda x: x["days_left"])
        return birthdays
    
    def get_announcements(self, limit: int = 10) -> List[Dict]:
        announcements = self.db.query(Announcement).filter(
            Announcement.is_active == True
        ).order_by(Announcement.created_at.desc()).limit(limit).all()

        return [
            {
                "id": str(a.id),
                "title": a.title,
                "content": a.content,
                "date": a.created_at.strftime("%d.%m.%Y"),
                "image_color": a.image_color,
            }
            for a in announcements
        ]
    
    def get_company_stats(self) -> Dict:
        employees_count = self.db.query(Employee).filter(
            Employee.status == "active"
        ).count()
        
        active_tickets = self.db.query(Ticket).filter(
            Ticket.status.in_(["new", "in_progress", "waiting"])
        ).count()
        
        equipment_in_use = self.db.query(Equipment).filter(
            Equipment.status == "in_use"
        ).count()
        
        # Tasks stats
        today = date.today()
        first_day_of_month = today.replace(day=1)
        
        tasks_total = self.db.query(func.count(Task.id)).scalar() or 0
        tasks_completed = self.db.query(func.count(Task.id)).filter(
            Task.status == "done"
        ).scalar() or 0

        tasks_completed_this_month = self.db.query(func.count(Task.id)).filter(
            Task.status == "done",
            Task.updated_at >= first_day_of_month
        ).scalar() or 0
        
        tasks_progress = 0
        if tasks_total > 0:
            tasks_progress = int((tasks_completed / tasks_total) * 100)
        
        return {
            "employees_count": employees_count,
            "active_tickets": active_tickets,
            "equipment_in_use": equipment_in_use,
            "tasks_total": tasks_total,
            "tasks_completed": tasks_completed,
            "tasks_progress": tasks_progress,
            "tasks_completed_this_month": tasks_completed_this_month
        }
    
    def get_dashboard_data(self) -> Dict:
        return {
            "birthdays": self.get_upcoming_birthdays(),
            "announcements": self.get_announcements(),
            "stats": self.get_company_stats(),
        }

    def get_calendar_events(
        self, from_d: datetime, to_d: datetime
    ) -> List[Dict[str, Any]]:
        """События календаря в заданном диапазоне (для всех)."""
        rows = (
            self.db.query(CalendarEvent)
            .filter(
                CalendarEvent.start_at < to_d,
                CalendarEvent.end_at > from_d,
            )
            .order_by(CalendarEvent.start_at)
            .all()
        )
        return [
            {
                "id": str(e.id),
                "title": e.title,
                "description": e.description,
                "start_at": e.start_at.isoformat() if e.start_at else None,
                "end_at": e.end_at.isoformat() if e.end_at else None,
                "is_all_day": e.is_all_day,
                "has_time": not e.is_all_day,
                "color": e.color or "#3B82F6",
                "type": "event",
            }
            for e in rows
        ]

    def get_calendar_tasks(
        self, user: User, from_d: datetime, to_d: datetime
    ) -> List[Dict[str, Any]]:
        """Задачи с датой/временем в заданном диапазоне (из доступных проектов)."""
        accessible = get_accessible_projects(self.db, user, include_archived=False)
        project_ids = [p.id for p, _ in accessible]
        if not project_ids:
            return []

        date_filter = or_(
            (Task.due_date >= from_d) & (Task.due_date <= to_d),
            (Task.start_date >= from_d) & (Task.start_date <= to_d),
        )
        tasks = (
            self.db.query(Task)
            .filter(
                Task.project_id.in_(project_ids),
                Task.archived_at.is_(None),
                date_filter,
            )
            .order_by(Task.start_date.asc().nullslast(), Task.due_date.asc().nullslast())
            .all()
        )

        result = []
        for t in tasks:
            start = t.start_date or t.due_date
            if not start:
                continue
            end = t.due_date or t.start_date
            # Задачи с указанным временем (не полночь) показываются в календаре по слотам
            has_time = (
                getattr(start, "hour", 0) != 0
                or getattr(start, "minute", 0) != 0
                or getattr(start, "second", 0) != 0
                or getattr(start, "microsecond", 0) != 0
            )
            result.append({
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "start_at": start.isoformat() if start else None,
                "end_at": end.isoformat() if end else None,
                "is_all_day": False,
                "has_time": has_time,
                "status": t.status,
                "priority": t.priority,
                "project_id": str(t.project_id),
                "type": "task",
            })
        return result

    def get_tasks_for_day(self, user: User, day: date) -> List[Dict[str, Any]]:
        """Задачи на указанный день (для блока «Задачи на сегодня»)."""
        from datetime import timezone
        from_d = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        to_d = datetime.combine(day, datetime.max.time(), tzinfo=timezone.utc)
        return self.get_calendar_tasks(user, from_d, to_d)
