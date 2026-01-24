#!/bin/bash

# =============================================================================
# Elements Platform - Скрипт резервного копирования
# =============================================================================

set -e

# Загрузка переменных окружения
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "Ошибка: .env.production не найден"
    exit 1
fi

# Директория для бэкапов
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Имя файла с датой
BACKUP_FILE="$BACKUP_DIR/elements_$(date +%Y%m%d_%H%M%S).sql"

echo "Создание резервной копии базы данных..."

# Создание дампа БД
docker exec elements-postgres pg_dump -U $POSTGRES_USER -d $POSTGRES_DB > $BACKUP_FILE

# Сжатие
gzip $BACKUP_FILE

echo "Резервная копия создана: ${BACKUP_FILE}.gz"

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Готово!"
