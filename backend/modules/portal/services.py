"""
Сервис агрегации данных для стартовой страницы Portal
"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.modules.hr.models.employee import Employee
from backend.modules.it.models import Ticket, Equipment
from backend.modules.hr.models.user import User
from backend.modules.portal.models import Announcement
from backend.modules.tasks.models import Task

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
