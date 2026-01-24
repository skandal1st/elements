FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Установка системных зависимостей для psycopg2
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements и устанавливаем зависимости
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Копируем весь проект (корень Elements)
COPY . /app

# Устанавливаем PYTHONPATH чтобы импорты работали
ENV PYTHONPATH=/app

EXPOSE 8000

# Запускаем из корня проекта
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
