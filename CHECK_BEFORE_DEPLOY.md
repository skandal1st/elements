# Чеклист перед развертыванием

## ✅ Проверьте перед загрузкой на сервер

### Безопасность

- [ ] `.env.production` НЕ добавлен в Git
- [ ] Все пароли в `.env.production` изменены на сильные
- [ ] `JWT_SECRET` - случайная строка минимум 32 символа
- [ ] `SEED_ADMIN_PASSWORD` - сильный пароль (мин. 16 символов)
- [ ] `POSTGRES_PASSWORD` - сильный пароль
- [ ] `REDIS_PASSWORD` - сильный пароль
- [ ] SSL сертификаты НЕ в Git
- [ ] Резервные копии БД НЕ в Git

### Конфигурация

- [ ] `DOMAIN` - указан правильный домен
- [ ] `CORS_ORIGINS` - указан только ваш домен (не *)
- [ ] `SEED_ADMIN_EMAIL` - правильный email администратора
- [ ] Порты 80 и 443 открыты в фаерволе
- [ ] DNS записи настроены на IP сервера

### Файлы

- [ ] `docker-compose.prod.yml` готов
- [ ] `nginx/conf.d/default.conf` настроен
- [ ] `.env.production.example` обновлен (без реальных паролей!)
- [ ] `deploy.sh` исполняемый (chmod +x)
- [ ] `backup.sh` исполняемый (chmod +x)
- [ ] `fix-docker-rate-limit.sh` исполняемый (chmod +x)

### Docker Hub

- [ ] Зарегистрирован аккаунт на hub.docker.com (бесплатно)
- [ ] Выполнен `docker login` перед развертыванием (рекомендуется)

### Документация

- [ ] `DEPLOYMENT.md` - инструкции актуальны
- [ ] `QUICK_DEPLOY.md` - инструкции актуальны
- [ ] `README.md` - обновлен

## 🔒 Генерация сильных паролей

### JWT Secret (32+ символов)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### PostgreSQL Password
```bash
openssl rand -base64 24
```

### Redis Password
```bash
openssl rand -base64 24
```

### Admin Password
```bash
openssl rand -base64 16
```

## 📋 Минимальные требования к серверу

- **ОС**: Ubuntu 20.04+ / Debian 11+
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 20 GB SSD
- **Порты**: 80, 443

## 🚀 Порядок развертывания

1. **Подготовка**
   - Настроить DNS записи
   - Открыть порты в фаерволе
   - Создать `.env.production` с сильными паролями

2. **Загрузка на сервер**
   ```bash
   # На локальной машине
   rsync -avz --exclude 'node_modules' --exclude '.git' \
     ./ root@your-server:/opt/elements/
   ```

3. **Развертывание**
   ```bash
   # На сервере
   cd /opt/elements
   sudo ./deploy.sh
   ```

4. **Настройка SSL**
   ```bash
   sudo apt install certbot
   sudo certbot certonly --standalone -d yourdomain.com
   ```

5. **Проверка**
   - Откройте https://yourdomain.com
   - Войдите с данными администратора
   - Проверьте все модули

6. **Настройка резервного копирования**
   ```bash
   # Добавьте в crontab
   0 2 * * * cd /opt/elements && ./backup.sh
   ```

## ⚠️ ВАЖНО

### НЕ коммитьте в Git:
- `.env.production`
- `ssl/` директорию
- `backups/` директорию
- Любые файлы с паролями

### Сразу после развертывания:
1. Измените пароль администратора в интерфейсе
2. Создайте резервную копию БД
3. Настройте мониторинг

## 🔍 Проверка после развертывания

```bash
# Проверка контейнеров
docker-compose -f docker-compose.prod.yml ps

# Должны быть все в состоянии "Up":
# - elements-postgres
# - elements-redis
# - elements-backend
# - elements-frontend
# - elements-nginx

# Проверка доступности
curl http://localhost/health
# Должен вернуть: OK

# Проверка логов
docker-compose -f docker-compose.prod.yml logs -f backend
# Не должно быть ошибок
```

## 📞 Если что-то пошло не так

1. Проверьте логи: `docker-compose -f docker-compose.prod.yml logs -f`
2. Проверьте `.env.production`: правильные ли значения?
3. Проверьте порты: `sudo netstat -tulpn | grep -E ':(80|443)'`
4. Проверьте фаервол: `sudo ufw status`
5. Изучите `DEPLOYMENT.md` раздел "Решение проблем"

## 📚 Документация

- Полная инструкция: [DEPLOYMENT.md](DEPLOYMENT.md)
- Быстрый старт: [QUICK_DEPLOY.md](QUICK_DEPLOY.md)
- Архитектура: [ARCHITECTURE.md](ARCHITECTURE.md)
