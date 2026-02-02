"""
Скрипт для проверки последних тикетов и их автораспределения
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.modules.it.models.ticket import Ticket
from backend.modules.hr.models.user import User
from backend.core.config import settings

# Создаем подключение к БД
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("=== Проверка последних тикетов ===\n")

# Получаем последние 5 тикетов
tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).limit(5).all()

if not tickets:
    print("❌ Тикеты не найдены")
    db.close()
    sys.exit(0)

for i, ticket in enumerate(tickets, 1):
    print(f"Тикет #{i}")
    print(f"   ID: {str(ticket.id)[:8]}...")
    print(f"   Название: {ticket.title}")
    print(f"   Источник: {ticket.source}")
    print(f"   Статус: {ticket.status}")
    print(f"   Создан: {ticket.created_at}")

    if ticket.assignee_id:
        assignee = db.query(User).filter(User.id == ticket.assignee_id).first()
        if assignee:
            print(f"   ✅ Назначен на: {assignee.full_name} ({assignee.email})")
        else:
            print(f"   ⚠️ Назначен на: {ticket.assignee_id} (пользователь не найден)")
    else:
        print(f"   ❌ НЕ НАЗНАЧЕН")

        # Проверяем почему не назначен
        if ticket.source in ["email", "rocketchat"]:
            print(f"   ⚠️ ВНИМАНИЕ: Тикет из внешнего источника ({ticket.source})")
            print(f"      но не был автоматически назначен!")
        elif ticket.source == "web":
            print(f"   ℹ️ Веб-тикет не назначается автоматически (ожидаемое поведение)")

    print()

# Проверяем IT-специалистов
print("\n=== IT-специалисты в системе ===")
users = db.query(User).all()
it_count = 0
for user in users:
    roles = user.roles or {}
    it_role = roles.get("it", None)
    if it_role in ["admin", "it_specialist"] or user.is_superuser:
        it_count += 1
        print(f"✅ {user.full_name} ({user.email}) - роль: {it_role}")

if it_count == 0:
    print("❌ IT-специалисты не найдены! Автораспределение не будет работать.")

db.close()
