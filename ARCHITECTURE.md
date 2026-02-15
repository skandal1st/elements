# Elements Platform - Архитектура проекта

> Comprehensive документация для AI-ассистентов и разработчиков
> Последнее обновление: 2026-02-15

---

## Оглавление

1. [Обзор системы](#обзор-системы)
2. [Технологический стек](#технологический-стек)
3. [Структура проекта](#структура-проекта)
4. [Архитектура Backend](#архитектура-backend)
5. [Архитектура Frontend](#архитектура-frontend)
6. [Модули системы](#модули-системы)
7. [Аутентификация и авторизация](#аутентификация-и-авторизация)
8. [База данных](#база-данных)
9. [Интеграции](#интеграции)
10. [Deployment](#deployment)
11. [Конфигурация](#конфигурация)

---

## Обзор системы

**Elements Platform** — модульная корпоративная платформа для автоматизации бизнес-процессов с поддержкой:

- **HR-модуль**: управление сотрудниками, структурой компании, отпусками, документами
- **IT-модуль**: helpdesk, управление оборудованием, заявки, каталог оборудования, интеграции (Email IMAP, Telegram, RocketChat, Zabbix)
- **Tasks-модуль**: управление проектами и задачами
- **Knowledge Core**: база знаний с LLM-нормализацией и семантическим поиском (Qdrant)
- **Documents-модуль**: внутренний документооборот, шаблоны .docx с плейсхолдерами, маршруты согласования, лист согласования PDF

**Основные особенности:**
- Мультимодульная архитектура (модули включаются через `ENABLED_MODULES`)
- Ролевая система (per-module roles: admin, employee, it_specialist, etc.)
- Интеграция с Active Directory (LDAP)
- Polling-based интеграции (Telegram, RocketChat, Email IMAP)
- Векторный поиск (Qdrant) для базы знаний
- LLM-интеграция через OpenRouter

---

## Технологический стек

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **ORM**: SQLAlchemy 2.0
- **Database**: PostgreSQL 15+
- **Cache/Queue**: Redis 7+
- **Vector DB**: Qdrant (для Knowledge Core)
- **Auth**: JWT (HS256)
- **Async**: asyncio, httpx

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Routing**: React Router DOM v7
- **State**: Zustand
- **UI**: Tailwind CSS, Lucide icons
- **Forms**: React Hook Form + Zod validation
- **HTTP**: Fetch API (custom client)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Process Manager**: Uvicorn (backend)
- **Node**: Node.js 20 (frontend build)

---

## Структура проекта

```
C:\code\elements/
├── backend/                      # FastAPI backend
│   ├── core/                     # Core utilities
│   │   ├── config.py            # Pydantic Settings (env-based)
│   │   ├── database.py          # SQLAlchemy setup, SessionLocal
│   │   ├── auth.py              # JWT create/verify, get_current_user
│   │   ├── auth_routes.py       # /api/v1/auth (login, logout, me)
│   │   ├── startup_migrations.py # Best-effort schema migrations (ALTER TABLE IF NOT EXISTS)
│   │   └── permissions.py       # Role-based access (require_role, require_superuser)
│   ├── modules/                 # Модули платформы
│   │   ├── hr/                  # HR модуль
│   │   │   ├── api.py           # APIRouter для /api/v1/hr
│   │   │   ├── models/          # SQLAlchemy models (User, Employee, Department, etc.)
│   │   │   ├── routes/          # Роуты (employees, departments, documents, etc.)
│   │   │   └── schemas/         # Pydantic schemas
│   │   ├── it/                  # IT модуль
│   │   │   ├── api.py           # APIRouter для /api/v1/it
│   │   │   ├── models.py        # Ticket, Equipment, EquipmentRequest, etc.
│   │   │   ├── routes/          # tickets, equipment, settings, integrations
│   │   │   ├── schemas/         # Pydantic schemas
│   │   │   └── services/        # telegram_service, rocketchat_service, email_service, zabbix_service
│   │   ├── tasks/               # Tasks модуль
│   │   │   ├── api.py
│   │   │   ├── models.py        # Project, Task
│   │   │   └── routes/
│   │   ├── knowledge_core/      # База знаний
│   │   │   ├── api.py
│   │   │   ├── models.py        # Article, ArticleChunk
│   │   │   └── services/        # qdrant_service, llm_service
│   │   └── documents/           # Документооборот и согласование
│   │       ├── api.py           # APIRouter для /api/v1/documents
│   │       ├── dependencies.py  # get_current_user, require_documents_roles
│   │       ├── models.py        # 9 моделей (Document, DocumentTemplate, ApprovalRoute, etc.)
│   │       ├── routes/          # documents, document_types, templates, approval_routes, approvals, comments
│   │       ├── schemas/         # Pydantic schemas
│   │       └── services/        # file_service, template_service, approval_engine, approval_sheet_service
│   ├── main.py                  # FastAPI app, startup/shutdown hooks (polling)
│   └── requirements.txt
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── modules/             # Модули (по аналогии с backend)
│   │   │   ├── hr/
│   │   │   │   └── pages/       # EmployeesPage, DepartmentsPage, etc.
│   │   │   ├── it/
│   │   │   │   └── pages/       # TicketsPage, EquipmentPage, SettingsPage
│   │   │   ├── tasks/
│   │   │   │   └── pages/
│   │   │   └── documents/       # Документооборот
│   │   │       ├── DocumentsLayout.tsx  # Tab-навигация
│   │   │       ├── pages/       # DocumentsListPage, DocumentCreatePage, DocumentDetailPage, TemplatesPage, etc.
│   │   │       └── components/  # ApprovalActions, ApprovalTimeline, PlaceholderForm, etc.
│   │   ├── shared/              # Shared utilities
│   │   │   ├── api/
│   │   │   │   └── client.ts    # Fetch wrapper (401 auto-logout)
│   │   │   ├── components/      # Переиспользуемые компоненты
│   │   │   ├── store/
│   │   │   │   ├── auth.store.ts # Zustand: auth state, token expiry check
│   │   │   │   └── ui.store.ts   # Zustand: UI state (theme, sidebar)
│   │   │   └── services/        # buildingsService, roomsService, documents.service.ts
│   │   ├── App.tsx              # Root component, periodic token expiry check (30s)
│   │   ├── main.tsx             # Entry point, loadFromStorage()
│   │   └── router.tsx           # React Router routes
│   ├── package.json
│   └── vite.config.ts
├── nginx/
│   └── conf.d/
│       └── default.conf         # Proxy /api → backend:8000, /* → frontend:80
├── shared/                      # Shared libraries (optional)
│   ├── python/
│   │   └── elements_common/     # JWT utils (Python)
│   └── typescript/
│       └── elements-common/     # JWT utils (TypeScript)
├── docker-compose.yml           # Development setup
├── docker-compose.prod.yml      # Production setup
├── .env.example                 # Environment template
└── ARCHITECTURE.md              # This file
```

---

## Архитектура Backend

### Основные компоненты

#### 1. **FastAPI Application** (`backend/main.py`)

```python
app = FastAPI(
    title="Elements Platform API",
    version="1.0.0",
    docs_url=f"{settings.api_v1_prefix}/docs",
)

# Startup hook
@app.on_event("startup")
async def on_startup():
    apply_startup_migrations()           # Best-effort ALTER TABLE
    await telegram_service.start_polling()  # Telegram bot polling
    await rocketchat_service.start_polling() # RocketChat polling
    # Email IMAP polling запускается в отдельной задаче

# Shutdown hook
@app.on_event("shutdown")
async def on_shutdown():
    await telegram_service.stop_polling()
    await rocketchat_service.stop_polling()
```

**Registered Routers:**
- `/api/v1/auth` — auth_routes (login, logout, me)
- `/api/v1/hr` — hr.api.router
- `/api/v1/it` — it.api.router
- `/api/v1/tasks` — tasks.api.router
- `/api/v1/it/knowledge` — knowledge_core.api.router
- `/api/v1/documents` — documents.api.router

#### 2. **Configuration** (`backend/core/config.py`)

```python
class Settings(BaseSettings):
    # App
    api_v1_prefix: str = "/api/v1"
    company_id: str | None = None
    enabled_modules: str = "hr,it,tasks,documents"  # Comma-separated

    # Database
    database_url: str

    # Auth (JWT)
    secret_key: str
    access_token_expire_minutes: int = 10080  # 7 days (overridden by Docker: 30→10080)
    access_token_expire_seconds: int | None = None
    algorithm: str = "HS256"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # LDAP (optional)
    ldap_server: str | None = None
    ldap_base_dn: str | None = None
    # ...

    class Config:
        env_file = ".env"
        case_sensitive = False
```

**Environment Priority:**
1. Docker Compose environment variables
2. `.env` file
3. Default values in code

#### 3. **Database** (`backend/core/database.py`)

```python
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Startup Migrations** (`backend/core/startup_migrations.py`):
- Best-effort `ALTER TABLE IF NOT EXISTS` для новых колонок
- Не заменяет Alembic, но позволяет быстро добавлять поля без миграций
- Примеры: `ensure_rocketchat_columns()`, `ensure_email_columns()`

#### 4. **Authentication** (`backend/core/auth.py`)

**JWT Token Creation:**
```python
def create_access_token(
    user_id: UUID,
    email: str,
    company_id: str | None = None,
    modules: List[str] | None = None,
    role: str | None = None,
    roles: Dict[str, str] | None = None,
    is_superuser: bool = False,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.utcnow() + (
        expires_delta or
        timedelta(seconds=settings.access_token_expire_seconds) or
        timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
        "company_id": company_id,
        "modules": modules,
        "role": role,
        "roles": roles,
        "is_superuser": is_superuser,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
```

**Current User Dependency:**
```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    # Decode JWT, verify exp, fetch user from DB
    # Raises HTTPException(401) if invalid/expired
```

**Permissions** (`backend/core/permissions.py`):
```python
def require_role(module: str, allowed_roles: List[str]):
    """Dependency для проверки роли в модуле."""
    # Пример: require_role("it", ["admin", "it_specialist"])

def require_superuser():
    """Dependency для суперадмина."""
```

#### 5. **Models Structure**

**Base Models:**
- `backend/modules/hr/models/user.py`: `User` (main auth user)
- `backend/modules/hr/models/employee.py`: `Employee` (HR data, связан с User)
- `backend/modules/hr/models/department.py`: `Department`

**IT Models** (`backend/modules/it/models.py`):
- `Ticket`: source (web/email/telegram/rocketchat), status, priority, category
- `Equipment`: инвентарь, связь с User (assigned_to)
- `EquipmentRequest`: заявки на оборудование
- `TicketComment`: комментарии к тикетам

**Tasks Models** (`backend/modules/tasks/models.py`):
- `Project`: проекты
- `Task`: задачи, связь с Ticket (linked_ticket_id)

**Knowledge Models** (`backend/modules/knowledge_core/models.py`):
- `Article`: статьи базы знаний
- `ArticleChunk`: чанки статей для векторного поиска

**Documents Models** (`backend/modules/documents/models.py`):
- `DocumentType`: типы документов (код, название, маршрут по умолчанию)
- `Document`: документы (статус: draft/pending_approval/approved/rejected/cancelled)
- `DocumentVersion`: версии файлов (version, file_path, file_name)
- `DocumentAttachment`: дополнительные вложения
- `DocumentComment`: комментарии к документам
- `DocumentTemplate`: шаблоны .docx с плейсхолдерами (JSONB)
- `ApprovalRoute`: маршруты согласования (steps JSONB: sequential/parallel)
- `ApprovalInstance`: экземпляры согласования (route_snapshot, attempt, current_step_order)
- `ApprovalStepInstance`: решения согласующих (pending/approved/rejected/skipped, carry_over)

---

## Архитектура Frontend

### State Management (Zustand)

**Auth Store** (`frontend/src/shared/store/auth.store.ts`):
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
  checkTokenExpiry: () => boolean;  // Called every 30s by App.tsx
}
```

**Token Expiry Check:**
- `App.tsx` проверяет каждые 30 секунд через `setInterval`
- Если токен истёк → автоматический `logout()` и редирект на `/login`

**UI Store** (`frontend/src/shared/store/ui.store.ts`):
```typescript
interface UIState {
  sidebarOpen: boolean;
  theme: "dark" | "light";
  // ...
}
```

### API Client (`frontend/src/shared/api/client.ts`)

```typescript
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    handleUnauthorized();  // logout() + redirect
    throw new Error("Сессия истекла");
  }
  // ...
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem("token");
  const response = await fetch(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<T>(response);
}
```

**Automatic 401 Handling:**
- Backend возвращает 401 при истёкшем токене
- Frontend автоматически вызывает `logout()` и редиректит на `/login`

### Routing (`frontend/src/router.tsx`)

```typescript
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedLayout />}>  {/* Requires auth */}
    <Route path="/" element={<DashboardPage />} />
    <Route path="/hr/employees" element={<EmployeesPage />} />
    <Route path="/it/tickets" element={<TicketsPage />} />
    <Route path="/it/equipment" element={<EquipmentPage />} />
    <Route path="/it/settings" element={<SettingsPage />} />
    <Route path="/tasks/projects" element={<ProjectsPage />} />
    {/* ... */}
  </Route>
</Routes>
```

---

## Модули системы

### HR Module

**Функционал:**
- Управление сотрудниками (Employee CRUD)
- Организационная структура (Department)
- Документы (Document, файлы на S3-совместимом хранилище)
- Отпуска (Leave)
- Интеграция с Active Directory (LDAP sync)

**API Endpoints:**
- `/api/v1/hr/employees`
- `/api/v1/hr/departments`
- `/api/v1/hr/documents`
- `/api/v1/hr/leaves`

**Роли:**
- `hr:admin` — полный доступ
- `hr:employee` — только свои данные

### IT Module

**Функционал:**
- Helpdesk (Ticket CRUD, comments, статусы, приоритеты)
- Управление оборудованием (Equipment, EquipmentRequest)
- Каталог оборудования (EquipmentCatalog)
- Расходники (Consumable)
- Лицензии (License)
- Интеграции: Email (IMAP), Telegram, RocketChat, Zabbix
- Уведомления (Notification)
- Отчёты (Reports)

**API Endpoints:**
- `/api/v1/it/tickets`
- `/api/v1/it/equipment`
- `/api/v1/it/equipment-catalog`
- `/api/v1/it/settings` — настройки интеграций
- `/api/v1/it/rocketchat` — RocketChat webhook/status
- `/api/v1/it/email` — Email IMAP status

**Роли:**
- `it:admin` — полный доступ
- `it:it_specialist` — работа с тикетами, оборудованием
- `it:employee` — создание тикетов, просмотр своих заявок

**Интеграции (подробнее в разделе [Интеграции](#интеграции)):**
- Email IMAP: polling входящих писем → создание тикетов
- Telegram: long-polling для команд бота, уведомления IT-специалистам
- RocketChat: polling `channels.history` → создание тикетов из канала
- Zabbix: мониторинг хостов (пока только GET /api/v1/it/zabbix/hosts)

### Tasks Module

**Функционал:**
- Управление проектами (Project)
- Управление задачами (Task)
- Связь задач с тикетами (linked_ticket_id)
- Telegram-бот: создание задач из тикетов через callback-кнопки

**API Endpoints:**
- `/api/v1/tasks/projects`
- `/api/v1/tasks/tasks`

**Роли:**
- `tasks:admin`
- `tasks:employee`

### Documents Module

**Функционал:**
- Документооборот: загрузка документов, версионирование, вложения, комментарии
- Шаблоны .docx с плейсхолдерами (визуальный редактор: выделение текста → создание плейсхолдера)
- Генерация документов из шаблонов с заполнением плейсхолдеров
- Маршруты согласования: визуальный редактор с drag-and-drop (@hello-pangea/dnd)
- Движок согласования: state machine (submit → approve/reject → resubmit с carry-over)
- Генерация PDF листа согласования (reportlab)
- Уведомления участникам (через модель Notification из IT-модуля)

**API Endpoints:**
- `/api/v1/documents/` — CRUD документов, загрузка, версии, вложения
- `/api/v1/documents/types/` — CRUD типов документов
- `/api/v1/documents/templates/` — CRUD шаблонов, загрузка .docx, set-placeholder, from-template
- `/api/v1/documents/routes/` — CRUD маршрутов согласования
- `/api/v1/documents/{id}/submit` — отправка на согласование
- `/api/v1/documents/{id}/approve` — согласование
- `/api/v1/documents/{id}/reject` — отклонение
- `/api/v1/documents/{id}/cancel` — отмена
- `/api/v1/documents/my-approvals` — документы ожидающие моего согласования
- `/api/v1/documents/{id}/approval-sheet` — скачать PDF лист согласования

**Роли:**
- `documents:admin` — полный доступ (типы, шаблоны, маршруты, все документы)
- `documents:specialist` — управление шаблонами, все документы
- `documents:employee` — создание своих документов, участие в согласовании

**Зависимости:**
- `python-docx` — парсинг и генерация .docx шаблонов
- `reportlab` — генерация PDF листа согласования

**Статусы документа:**
```
draft → pending_approval → approved
              ↓
          rejected → pending_approval (повторная отправка с carry-over)
draft → cancelled
```

**Важно: порядок роутеров в `api.py`:**
Роуты с фиксированными путями (`/types`, `/templates`, `/routes`, `/my-approvals`) регистрируются ДО роута `/{document_id}`, иначе FastAPI попытается распарсить фиксированный сегмент как UUID и вернёт 422.

### Knowledge Core Module

**Функционал:**
- База знаний (Article CRUD)
- LLM-нормализация статей (через OpenRouter)
- Векторный поиск (Qdrant)
- Chunking статей (ArticleChunk)

**API Endpoints:**
- `/api/v1/it/knowledge/articles`
- `/api/v1/it/knowledge/search`

**Настройки (в IT Settings):**
- `llm_normalization_enabled`
- `llm_suggestions_enabled`
- `openrouter_base_url`
- `openrouter_api_key`
- `openrouter_model`

---

## Аутентификация и авторизация

### JWT Token Flow

1. **Login** (`POST /api/v1/auth/login`):
   - Input: `{ "email": "user@example.com", "password": "..." }`
   - Backend: verify password (bcrypt), create JWT
   - Response: `{ "access_token": "eyJ...", "user": {...} }`

2. **Frontend Storage**:
   - Token хранится в `localStorage.getItem("token")`
   - Auth store синхронизируется с localStorage

3. **Request Authorization**:
   - Каждый API request: `Authorization: Bearer <token>`
   - Backend: `get_current_user(token)` dependency

4. **Token Expiration**:
   - Default: 7 days (`access_token_expire_minutes=10080`)
   - Docker override: был 30 минут (исправлено на 10080)
   - Frontend проверяет `exp` каждые 30 секунд
   - При истечении: auto-logout + redirect

5. **No Refresh Token**:
   - Система не использует refresh tokens
   - После истечения access token требуется повторный login

### Role-Based Access Control (RBAC)

**User Model** (`backend/modules/hr/models/user.py`):
```python
class User(Base):
    __tablename__ = "users"

    id: UUID
    email: str
    password_hash: str
    is_superuser: bool = False
    roles: Dict[str, str] | None = None  # JSONB: {"hr": "admin", "it": "it_specialist"}
    # ...
```

**Роли по модулям:**
- `hr`: `admin`, `hr`, `employee`
- `it`: `admin`, `it_specialist`, `employee`, `auditor`
- `tasks`: `admin`, `employee`
- `documents`: `admin`, `specialist`, `employee`

**Проверка прав:**
```python
# Backend
@router.get("/tickets", dependencies=[Depends(require_role("it", ["admin", "it_specialist"]))])
def get_tickets(...): ...

# Frontend (client-side filtering)
if (user.roles?.it === "admin" || user.roles?.it === "it_specialist") {
  // Показываем админ-функции
}
```

### LDAP Integration

**Синхронизация сотрудников:**
- `POST /api/v1/it/settings/ldap/sync-employees`
- Импорт пользователей из Active Directory в таблицу `employees`
- Не создаёт `users` автоматически (требуется ручное назначение ролей)

---

## База данных

### PostgreSQL Schema

**Основные таблицы:**

#### HR Module
- `users` — аутентификация, роли
- `employees` — HR-данные сотрудников
- `departments` — организационная структура
- `documents` — документы
- `leaves` — отпуска
- `system_settings` — конфигурация системы (интеграции, LDAP, SMTP, etc.)

#### IT Module
- `tickets` — заявки helpdesk
- `ticket_comments` — комментарии к заявкам
- `equipment` — оборудование
- `equipment_requests` — заявки на оборудование
- `equipment_catalog` — каталог оборудования
- `consumables` — расходники
- `licenses` — лицензии
- `notifications` — уведомления

#### Tasks Module
- `projects` — проекты
- `tasks` — задачи

#### Knowledge Core
- `articles` — статьи базы знаний
- `article_chunks` — чанки для векторного поиска

#### Documents Module
- `document_types` — типы документов (name, code, default_route_id)
- `documents` — документы (status, creator_id, approval_route_id, current_version)
- `document_versions` — версии файлов (version, file_path, file_size)
- `document_attachments` — дополнительные вложения
- `document_comments` — комментарии к документам
- `document_templates` — шаблоны .docx (placeholders JSONB, file_path)
- `approval_routes` — маршруты согласования (steps JSONB)
- `approval_instances` — экземпляры согласования (route_snapshot, attempt)
- `approval_step_instances` — решения согласующих (status, carry_over)

### Migrations Strategy

**Best-Effort Startup Migrations:**
- `backend/core/startup_migrations.py`
- Выполняется на каждом запуске приложения (`on_startup()`)
- Использует `ALTER TABLE IF NOT EXISTS` (PostgreSQL-specific)
- Примеры:
  ```python
  def ensure_rocketchat_columns():
      statements = [
          "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rocketchat_message_id VARCHAR(255)",
          "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rocketchat_sender VARCHAR(255)",
      ]
      for sql in statements:
          _exec_best_effort(sql)
  ```

**Alembic (не используется):**
- В проекте есть `alembic/`, но миграции не актуальны
- Основной способ обновления схемы — startup migrations

---

## Интеграции

### 1. Email IMAP (IT Module)

**Назначение:** Автоматическое создание тикетов из входящих писем.

**Конфигурация** (`/api/v1/it/settings`, группа `email`):
- `imap_enabled`: bool
- `imap_server`: str (например, `imap.gmail.com`)
- `imap_port`: int (обычно 993)
- `imap_email`: str
- `imap_password`: str (App Password для Gmail)
- `imap_folder`: str (по умолчанию `INBOX`)
- `imap_poll_interval`: int (секунды, по умолчанию 60)

**Архитектура:**
- **Polling**: фоновая задача (`backend/modules/it/services/email_service.py`)
- Запускается в `on_startup()` (отдельно от других polling-сервисов)
- Цикл: каждые `imap_poll_interval` секунд → `IMAP SEARCH UNSEEN` → создание тикетов
- Дедупликация: по `email_message_id` (Message-ID header)
- Маппинг пользователей: поиск `User.email == sender_email`
- Если пользователь не найден: `status="pending_user"`, `email_sender=<email>`

**Формат тикета:**
- `title` = Subject (обрезается до 255 символов)
- `description` = Body (plain text или HTML → markdown)
- `source` = `"email"`
- `category` = `"other"`
- `priority` = `"medium"`

**Логи:**
- `[Email] Polling запущен`
- `[Email] Новое письмо: <subject>`
- `[Email] Ошибка подключения к IMAP: <error>`

### 2. Telegram Bot (IT Module)

**Назначение:**
- Уведомления IT-специалистам о новых тикетах
- Привязка Telegram-аккаунта к User
- Просмотр активных тикетов
- Создание задач (Tasks) из тикетов через callback-кнопки

**Конфигурация** (`/api/v1/it/settings`, группа `telegram`):
- `telegram_bot_enabled`: bool
- `telegram_bot_token`: str (от @BotFather)
- `telegram_bot_username`: str (автозаполняется после теста)

**Архитектура:**
- **Long-Polling**: `getUpdates` с `timeout=30s` (Telegram API)
- Service: `backend/modules/it/services/telegram_service.py`
- Запуск: `telegram_service.start_polling()` в `on_startup()`
- Остановка: `telegram_service.stop_polling()` в `on_shutdown()`

**Команды:**
- `/start <link_code>` — привязка аккаунта (link_code генерируется в UI)
- `/menu`, `меню` — главное меню
- `/tickets`, `тикеты` — список активных тикетов

**Callback-кнопки:**
- `tickets_active_<page>` — пагинация тикетов
- `ticket_view_<ticket_id>` — просмотр тикета
- `ticket_task_<ticket_id>` — создать задачу из тикета

**Уведомления:**
- `notify_new_ticket(ticket_id, title)` → всем IT-специалистам
- `notify_ticket_assigned(assignee_id, ticket_id, title)` → назначенному специалисту
- `notify_ticket_status_changed(user_id, ticket_id, title, new_status)` → создателю тикета
- `notify_ticket_comment(user_id, ticket_id, title, commenter_name)` → создателю тикета

**Привязка аккаунта:**
1. User открывает IT → Telegram в UI
2. Backend генерирует `telegram_link_code` (6 цифр, expires через 10 минут)
3. User переходит по ссылке `https://t.me/<bot_username>?start=<code>`
4. Бот получает `/start <code>`, проверяет валидность, привязывает `telegram_id`

### 3. RocketChat (IT Module)

**Назначение:** Автоматическое создание тикетов из сообщений в канале RocketChat.

**Конфигурация** (`/api/v1/it/settings`, группа `rocketchat`):
- `rocketchat_enabled`: bool
- `rocketchat_url`: str (например, `https://chat.company.com`)
- `rocketchat_user_id`: str (User ID бота)
- `rocketchat_auth_token`: str (Auth Token бота, получается через `/api/v1/login`)
- `rocketchat_webhook_token`: str (опционально, для Outgoing Webhook)
- `rocketchat_channel_name`: str (канал для заявок, например `helpdesk`)
- `rocketchat_bot_user_id`: str (тот же User ID, для фильтрации сообщений бота)

**Архитектура:**
- **Основной режим**: Polling через `GET /api/v1/channels.history` или `/api/v1/groups.history` (для private channels)
- **Альтернатива**: Outgoing Webhook (требует сетевой доступности Elements из RocketChat)
- Service: `backend/modules/it/services/rocketchat_service.py`
- Запуск: `rocketchat_service.start_polling()` в `on_startup()`
- Polling interval: 10 секунд

**Особенности:**
- Поддержка public channels (`channels.info`, `channels.history`) и private groups (`groups.info`, `groups.history`)
- Дедупликация: по `rocketchat_message_id` (поле `_id` сообщения)
- Фильтрация:
  - Системные сообщения (поле `t` не пустое) игнорируются
  - Сообщения бота (поле `bot=true` или `user_id == rocketchat_bot_user_id`) игнорируются
- Треды: если сообщение имеет `tmid` (thread message ID), оно добавляется как комментарий к существующему тикету
- Маппинг пользователей: по `User.username == rc_username` (case-insensitive)

**Формат тикета:**
- `title` = первая строка (до 255 символов)
- `description` = полный текст
- `source` = `"rocketchat"`
- `rocketchat_message_id` = `_id` сообщения
- `rocketchat_sender` = `username` отправителя

**Уведомления:**
- После создания тикета бот отправляет в канал: `Заявка #<short_id> создана\n<url>`
- При смене статуса: `@<username> Статус заявки #<short_id> изменён на «<статус>»`
- При назначении специалиста: `@<username> По заявке #<short_id> назначен исполнитель: <имя>`

**Получение User ID и Auth Token:**
```bash
curl -X POST https://chat.company.com/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"user": "bot_username", "password": "bot_password"}'
```

Response:
```json
{
  "data": {
    "userId": "aBcDeFgHiJkLmN",
    "authToken": "9HqLlyZOugoStsXC..."
  }
}
```

### 4. Zabbix (IT Module)

**Назначение:** Интеграция с мониторингом Zabbix (пока минимальная).

**Конфигурация** (`/api/v1/it/settings`, группа `zabbix`):
- `zabbix_enabled`: bool
- `zabbix_url`: str (например, `https://zabbix.company.com/api_jsonrpc.php`)
- `zabbix_api_token`: str (Bearer token для Zabbix 7.x)

**API Endpoints:**
- `GET /api/v1/it/zabbix/hosts` — список хостов

**Планы:**
- Автоматическое создание тикетов из Zabbix alerts
- Синхронизация оборудования с Zabbix

---

## Deployment

### Docker Compose (Development)

**Файл:** `docker-compose.yml`

**Services:**
- `postgres` — PostgreSQL 15
- `redis` — Redis 7
- `qdrant` — Qdrant (векторная БД)
- `backend` — FastAPI app (порт 8000)
- `frontend` — React app (Nginx на порту 80)
- `nginx` — reverse proxy (порт 80 → backend:8000 или frontend:80)

**Volumes:**
- `postgres_data` — данные PostgreSQL
- `redis_data` — данные Redis
- `qdrant_data` — данные Qdrant
- `uploads_data` — загруженные файлы (документы, шаблоны, вложения тикетов)

**Environment Variables:**
```yaml
backend:
  environment:
    - DATABASE_URL=postgresql://elements:elements@postgres:5432/elements
    - SECRET_KEY=${JWT_SECRET:-elements-super-secret-key-change-in-production-min-32-chars}
    - ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days
    - REDIS_URL=redis://redis:6379/0
    - ENABLED_MODULES=${ENABLED_MODULES:-hr,it,tasks,documents}
    - QDRANT_URL=http://qdrant:6333
```

**Запуск:**
```bash
docker compose up -d
```

**Доступ:**
- Frontend: http://localhost
- Backend API: http://localhost/api/v1
- API Docs: http://localhost/api/v1/docs

### Docker Compose (Production)

**Файл:** `docker-compose.prod.yml`

**Отличия от dev:**
- Используются переменные из `.env` (обязательно)
- Нет дефолтных значений для паролей
- Frontend собирается через multi-stage build

**Переменные окружения (.env):**
```env
# Database
POSTGRES_USER=elements
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=elements

# Redis
REDIS_PASSWORD=<strong-password>

# JWT
JWT_SECRET=<min-32-chars-secret>

# Modules
ENABLED_MODULES=hr,it,tasks,documents

# License Server (optional)
LICENSE_SERVER_URL=http://license-server:8001
COMPANY_ID=<company-uuid>

# OpenRouter (optional, for Knowledge Core)
OPENROUTER_API_KEY=<key>
OPENROUTER_MODEL=anthropic/claude-3-sonnet
```

**Запуск:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Nginx Configuration

**Файл:** `nginx/conf.d/default.conf`

```nginx
upstream backend {
    server backend:8000;
}

server {
    listen 80;

    # Frontend
    location / {
        proxy_pass http://frontend:80;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Docs
    location /docs {
        proxy_pass http://backend;
    }
}
```

---

## Конфигурация

### System Settings (DB)

**Таблица:** `system_settings`

```sql
CREATE TABLE system_settings (
    id UUID PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50),  -- "general", "email", "telegram", "rocketchat", etc.
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Группы настроек:**

#### General
- `public_app_url` — публичный URL системы (для ссылок в уведомлениях)

#### Email (IMAP)
- `imap_enabled`, `imap_server`, `imap_port`, `imap_email`, `imap_password`, `imap_folder`, `imap_poll_interval`

#### SMTP (отправка)
- `smtp_enabled`, `smtp_server`, `smtp_port`, `smtp_email`, `smtp_password`, `smtp_from_name`

#### Telegram
- `telegram_bot_enabled`, `telegram_bot_token`, `telegram_bot_username`

#### RocketChat
- `rocketchat_enabled`, `rocketchat_url`, `rocketchat_user_id`, `rocketchat_auth_token`, `rocketchat_webhook_token`, `rocketchat_channel_name`, `rocketchat_bot_user_id`

#### Zabbix
- `zabbix_enabled`, `zabbix_url`, `zabbix_api_token`

#### LDAP
- `ldap_server`, `ldap_base_dn`, `ldap_bind_dn`, `ldap_bind_password`, `ldap_user_filter`, `ldap_sync_enabled`

#### LLM / OpenRouter (Knowledge Core)
- `llm_normalization_enabled`, `llm_suggestions_enabled`, `openrouter_base_url`, `openrouter_api_key`, `openrouter_model`

#### Active Directory Integration
- `ad_enabled`, `ad_server`, `ad_domain`, `ad_username`, `ad_password`, `ad_base_dn`, `ad_user_filter`, `ad_group_filter`

**API Endpoints:**
- `GET /api/v1/it/settings` — получить все настройки (сгруппированные)
- `PUT /api/v1/it/settings/{key}` — обновить настройку
- `POST /api/v1/it/settings/bulk` — массовое обновление
- `POST /api/v1/it/settings/test/smtp` — тест SMTP
- `POST /api/v1/it/settings/test/telegram` — тест Telegram
- `POST /api/v1/it/settings/test/rocketchat` — тест RocketChat
- `POST /api/v1/it/settings/ldap/sync-employees` — синхронизация LDAP

**Sensitive Keys Masking:**
- Пароли и токены маскируются как `"********"` в API responses
- Список sensitive keys: `imap_password`, `smtp_password`, `telegram_bot_token`, `rocketchat_auth_token`, `rocketchat_webhook_token`, `zabbix_api_token`, `ldap_bind_password`, `ad_password`, `openrouter_api_key`

---

## Common Patterns

### 1. Adding a New Integration

**Example: Slack Integration**

**Backend:**
1. Создать `backend/modules/it/services/slack_service.py`:
   ```python
   class SlackService:
       def __init__(self):
           self._polling_task = None
           self._polling_active = False

       async def start_polling(self): ...
       async def stop_polling(self): ...
       async def send_message(self, channel, text): ...

   slack_service = SlackService()
   ```

2. Добавить настройки в `backend/modules/it/schemas/settings.py`:
   ```python
   class SlackSettings(BaseModel):
       slack_enabled: bool = False
       slack_bot_token: str | None = None
       slack_channel: str | None = None
   ```

3. Добавить роут `backend/modules/it/routes/slack.py`:
   ```python
   router = APIRouter(prefix="/slack", tags=["slack"])

   @router.post("/test")
   async def test_slack(db: Session = Depends(get_db)):
       return await slack_service.check_connection(db)
   ```

4. Зарегистрировать в `backend/modules/it/api.py`:
   ```python
   from .routes import slack
   router.include_router(slack.router)
   ```

5. Добавить startup hook в `backend/main.py`:
   ```python
   @app.on_event("startup")
   async def on_startup():
       # ...
       await slack_service.start_polling()
   ```

6. Добавить миграцию (optional):
   ```python
   # backend/core/startup_migrations.py
   def ensure_slack_columns():
       _exec_best_effort("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS slack_thread_ts VARCHAR(255)")
   ```

**Frontend:**
1. Добавить тип в `frontend/src/modules/it/pages/SettingsPage.tsx`:
   ```typescript
   type SlackSettings = {
       slack_enabled?: boolean;
       slack_bot_token?: string;
       slack_channel?: string;
   };
   ```

2. Добавить таб:
   ```tsx
   const TABS = [
       // ...
       { id: "slack", label: "Slack", icon: MessageSquare },
   ];
   ```

3. Добавить рендер настроек:
   ```tsx
   {activeTab === "slack" && (
       <div className="space-y-4">
           {renderInput("Включить Slack", "slack", "slack_enabled", "checkbox")}
           {renderInput("Bot Token", "slack", "slack_bot_token", "password")}
           {renderInput("Channel ID", "slack", "slack_channel", "text")}
       </div>
   )}
   ```

### 2. Adding a New Ticket Source

**Example: WhatsApp**

1. Добавить `source="whatsapp"` в `backend/modules/it/models.py`:
   ```python
   source = Column(String(50), nullable=False, default="web")
   # Допустимые: "web", "email", "telegram", "rocketchat", "whatsapp"
   ```

2. Добавить иконку во фронтенд:
   ```tsx
   // frontend/src/modules/it/pages/TicketsPage.tsx
   case "whatsapp":
       return <MessageCircle className="w-4 h-4 text-green-500" />;
   ```

3. Создать сервис `whatsapp_service.py` (см. паттерн выше)

### 3. Adding a New Module

**Example: CRM Module**

1. Создать структуру:
   ```
   backend/modules/crm/
   ├── __init__.py
   ├── api.py           # APIRouter для /api/v1/crm
   ├── models.py        # Lead, Deal, Contact
   ├── routes/
   │   ├── leads.py
   │   ├── deals.py
   │   └── contacts.py
   └── schemas/
       └── lead.py
   ```

2. Зарегистрировать в `backend/main.py`:
   ```python
   if "crm" in settings.get_enabled_modules():
       from backend.modules.crm import api as crm_api
       app.include_router(crm_api.router)
   ```

3. Добавить во фронтенд:
   ```
   frontend/src/modules/crm/
   ├── pages/
   │   ├── LeadsPage.tsx
   │   └── DealsPage.tsx
   └── components/
   ```

4. Обновить `.env`:
   ```env
   ENABLED_MODULES=hr,it,tasks,documents,crm
   ```

---

## Troubleshooting

### Проблема: Пользователи разлогиниваются каждые 30 минут

**Причина:** `ACCESS_TOKEN_EXPIRE_MINUTES=30` в docker-compose.yml

**Решение:** Изменить на `ACCESS_TOKEN_EXPIRE_MINUTES=10080` (7 дней) в обоих файлах:
- `docker-compose.yml:115`
- `docker-compose.prod.yml:83`

### Проблема: RocketChat тикеты не создаются

**Диагностика:**
1. Проверить логи backend: `docker logs <backend-container> | grep RocketChat`
2. Убедиться, что `rocketchat_enabled=true`
3. Проверить, что бот добавлен в канал
4. Проверить, что канал — public или бот имеет доступ к private group

**Частые ошибки:**
- `Канал '<name>' не найден` → бот не состоит в канале или неверное имя
- `channels.history вернул 401` → неверный User ID или Auth Token
- `Polling не запущен` → интеграция отключена или отсутствуют настройки

### Проблема: Email тикеты не создаются

**Диагностика:**
1. Проверить логи: `docker logs <backend-container> | grep Email`
2. Проверить настройки IMAP (сервер, порт, логин, пароль)
3. Для Gmail: использовать App Password, не обычный пароль

**Частые ошибки:**
- `Connection refused` → неверный сервер или порт
- `Authentication failed` → неверный пароль (для Gmail нужен App Password)

### Проблема: Telegram бот не отвечает

**Диагностика:**
1. Проверить логи: `docker logs <backend-container> | grep Telegram`
2. Проверить токен через `curl https://api.telegram.org/bot<TOKEN>/getMe`
3. Убедиться, что polling запущен: лог `[Telegram] Polling запущен`

**Частые ошибки:**
- `401 Unauthorized` → неверный токен
- `Polling не запущен` → интеграция отключена

---

## Performance Considerations

### Database Indexes

**Recommended indexes:**
```sql
-- Tickets
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_source ON tickets(source);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_creator_id ON tickets(creator_id);
CREATE INDEX idx_tickets_assignee_id ON tickets(assignee_id);

-- Equipment
CREATE INDEX idx_equipment_assigned_to ON equipment(assigned_to_id);

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
```

### Caching Strategy

**Redis Usage:**
- Session storage (future)
- Rate limiting (future)
- Cache for expensive queries (future)

**In-Memory Cache:**
- RocketChat channel ID: `rocketchat_service._channel_id`
- Telegram channel ID: кэш в памяти не используется

### Polling Intervals

**Recommended values:**
- Email IMAP: 60-300 секунд (низкочастотная почта)
- Telegram: long-polling с timeout=30s (нет дополнительного sleep)
- RocketChat: 10 секунд (можно увеличить до 30-60 для снижения нагрузки)

---

## Security Best Practices

### 1. JWT Secret
- Использовать минимум 32 символа
- Не использовать дефолтный ключ в продакшене
- Ротация ключа: невозможна без ре-логина всех пользователей

### 2. Passwords
- Bcrypt hashing (backend/core/auth.py)
- Минимум 8 символов (рекомендуется 12+)

### 3. Sensitive Settings
- Автоматическая маскировка паролей в API responses
- Sensitive keys: все токены, пароли, API keys

### 4. CORS
- Настроить `CORS_ORIGINS` в production
- По умолчанию: `allow_origins=["*"]` (для dev)

### 5. Rate Limiting
- Пока не реализовано
- Рекомендуется добавить для `/api/v1/auth/login`

---

## Future Improvements

### Short-term
1. **Refresh Token Mechanism** — избежать ре-логина каждые 7 дней
2. **WebSocket Support** — real-time уведомления вместо polling
3. **File Upload Service** — S3-совместимое хранилище для документов/аттачментов
4. **Alembic Migrations** — актуализировать схему миграций

### Mid-term
1. **Multi-tenancy** — поддержка нескольких компаний в одной инсталляции
2. **Advanced Reporting** — дашборды, аналитика по тикетам/оборудованию
3. **Mobile App** — React Native или PWA
4. **SSO Integration** — SAML, OAuth2

### Long-term
1. **Microservices Architecture** — разделение модулей на отдельные сервисы
2. **Kubernetes Deployment** — для масштабирования
3. **Event-Driven Architecture** — Kafka/RabbitMQ для межмодульной коммуникации

---

## Contact & Support

**Repository:** (Указать ссылку на GitLab/GitHub)

**Documentation:**
- This file: `ARCHITECTURE.md`
- API Docs: http://localhost/api/v1/docs (Swagger UI)

**Maintainers:**
- (Указать контакты)

---

**Last Updated:** 2026-02-15

**Version:** 1.1.0
