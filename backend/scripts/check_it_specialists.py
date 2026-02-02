"""
Скрипт для проверки IT-специалистов в системе
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.modules.hr.models.user import User
from backend.core.config import settings

# Создаем подключение к БД
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("=== Проверка IT-специалистов в системе ===\n")

# Получаем всех пользователей
users = db.query(User).all()

print(f"Всего пользователей в системе: {len(users)}\n")

# Проверяем IT-специалистов
it_specialists = []
for user in users:
    roles = user.roles or {}
    it_role = roles.get("it", None)

    if it_role in ["admin", "it_specialist"] or user.is_superuser:
        it_specialists.append(user)
        print(f"✅ IT-специалист найден:")
        print(f"   ID: {user.id}")
        print(f"   Email: {user.email}")
        print(f"   Имя: {user.full_name}")
        print(f"   Роль IT: {it_role}")
        print(f"   Суперпользователь: {user.is_superuser}")
        print(f"   Все роли: {user.roles}")
        print()

if not it_specialists:
    print("❌ IT-специалисты не найдены!")
    print("\nДля назначения роли IT-специалиста:")
    print("1. Зайдите в веб-интерфейс как администратор")
    print("2. Перейдите в HR → Пользователи")
    print("3. Откройте карточку пользователя")
    print("4. В разделе 'IT' выберите роль 'ИТ-специалист'")
else:
    print(f"✅ Найдено IT-специалистов: {len(it_specialists)}")

db.close()
