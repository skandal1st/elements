"""
Сервис агрегации данных для стартовой страницы Portal
"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session

from backend.modules.hr.models.employee import Employee
from backend.modules.it.models import Ticket, Equipment
from backend.modules.hr.models.user import User


class PortalService:
    """Сервис для агрегации данных портала"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_upcoming_birthdays(self, days_ahead: int = 7) -> List[Dict]:
        """
        Получает ближайшие дни рождения сотрудников.
        
        Args:
            days_ahead: Количество дней вперед для поиска (по умолчанию 7)
        
        Returns:
            Список словарей с информацией о днях рождения
        """
        today = date.today()
        end_date = today + timedelta(days=days_ahead)
        
        # Получаем сотрудников с днями рождения в указанном диапазоне
        # Включаем активных сотрудников и кандидатов
        employees = self.db.query(Employee).filter(
            Employee.birthday.isnot(None),
            Employee.status.in_(["active", "candidate", "hired"])
        ).all()
        
        birthdays = []
        for employee in employees:
            if not employee.birthday:
                continue
            
            # Вычисляем день рождения в текущем году
            birthday_this_year = employee.birthday.replace(year=today.year)
            
            # Если день рождения уже прошел в этом году, берем следующий год
            if birthday_this_year < today:
                birthday_this_year = birthday_this_year.replace(year=today.year + 1)
            
            # Проверяем, попадает ли в диапазон
            if today <= birthday_this_year <= end_date:
                days_left = (birthday_this_year - today).days
                birthdays.append({
                    "id": employee.id,
                    "name": employee.full_name,
                    "date": birthday_this_year.isoformat(),
                    "days_left": days_left,
                    "department": employee.department.name if employee.department else None,
                })
        
        # Сортируем по количеству дней до дня рождения
        birthdays.sort(key=lambda x: x["days_left"])
        
        return birthdays
    
    def get_announcements(self, limit: int = 10) -> List[Dict]:
        """
        Получает важные объявления для всех сотрудников.
        
        Args:
            limit: Максимальное количество объявлений
        
        Returns:
            Список объявлений
        """
        # TODO: Создать модель Announcement для хранения объявлений
        # Пока возвращаем пустой список
        return []
    
    def get_company_stats(self) -> Dict:
        """
        Получает статистику по компании.
        
        Returns:
            Словарь со статистикой
        """
        # Количество активных сотрудников
        employees_count = self.db.query(Employee).filter(
            Employee.status == "active"
        ).count()
        
        # Количество активных заявок
        active_tickets = self.db.query(Ticket).filter(
            Ticket.status.in_(["new", "in_progress", "waiting"])
        ).count()
        
        # Количество оборудования в использовании
        equipment_in_use = self.db.query(Equipment).filter(
            Equipment.status == "in_use"
        ).count()
        
        return {
            "employees_count": employees_count,
            "active_tickets": active_tickets,
            "equipment_in_use": equipment_in_use,
        }
    
    def get_dashboard_data(self) -> Dict:
        """
        Получает все данные для стартовой страницы.
        
        Returns:
            Словарь со всеми данными для dashboard
        """
        return {
            "birthdays": self.get_upcoming_birthdays(),
            "announcements": self.get_announcements(),
            "stats": self.get_company_stats(),
        }
