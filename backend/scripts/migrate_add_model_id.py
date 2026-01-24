"""
Скрипт миграции: добавление колонки model_id в таблицу equipment
"""
import sys
from pathlib import Path

# Добавляем корень проекта в путь
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from backend.core.database import engine


def migrate_add_model_id():
    """Добавляет колонку model_id в таблицу equipment если её нет"""
    print("=" * 60)
    print("Миграция: добавление model_id в таблицу equipment")
    print("=" * 60)
    
    with engine.connect() as conn:
        try:
            # Проверяем существование колонки model_id
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'equipment' AND column_name = 'model_id'
            """))
            
            if result.fetchone():
                print("✅ Колонка model_id уже существует, миграция не требуется")
                return
            
            # Проверяем существование таблиц справочника
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'equipment_models'
            """))
            
            if not result.fetchone():
                print("⚠️  Таблица equipment_models не существует")
                print("   Сначала запустите: python backend/scripts/init_db.py")
                return
            
            # Добавляем колонку model_id
            print("Добавление колонки model_id в таблицу equipment...")
            conn.execute(text("""
                ALTER TABLE equipment 
                ADD COLUMN model_id UUID REFERENCES equipment_models(id) ON DELETE SET NULL
            """))
            conn.commit()
            print("✅ Миграция выполнена успешно")
            
        except Exception as e:
            print(f"❌ Ошибка миграции: {e}")
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate_add_model_id()
