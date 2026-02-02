# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elements Platform is a modular corporate automation platform built as a monolithic application with pluggable modules. The system uses FastAPI (Python) for backend and React with TypeScript for frontend.

**Key Modules:**
- **HR**: Employee management, org structure, LDAP/AD integration
- **IT**: Helpdesk tickets, equipment inventory, multi-channel integrations (Email IMAP, Telegram, RocketChat, Zabbix)
- **Tasks**: Project and task management with ticket linking
- **Knowledge Core**: LLM-powered knowledge base with semantic search (Qdrant)

**Architecture:** Modular monolith with JWT authentication, per-module RBAC, polling-based integrations, and Docker deployment.

## Development Commands

### Backend (FastAPI)

```bash
# From backend/ directory
pip install -r requirements.txt

# Initialize database (creates tables and seed admin)
python scripts/init_db.py

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# API docs will be available at http://localhost:8000/api/v1/docs
```

**Environment Variables Required:**
```env
DATABASE_URL=postgresql://elements:elements@localhost:5432/elements
SECRET_KEY=<min-32-chars>
REDIS_URL=redis://localhost:6379/0
ENABLED_MODULES=hr,it,tasks
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days
```

### Frontend (React + Vite)

```bash
# From frontend/ directory
npm install

# Development server (with proxy to backend)
npm run dev  # Runs on http://localhost:5173

# Production build
npm run build  # Output to dist/
```

### Docker Compose

```bash
# Development (includes PostgreSQL, Redis, Qdrant)
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Database

```bash
# Initialize database (run once after first setup)
cd backend && python scripts/init_db.py

# Default admin credentials:
# Email: admin@elements.local
# Password: admin123
# (configurable via SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD)
```

## Architecture & Code Organization

### Module System

All modules follow a canonical structure:

```
backend/modules/{module}/
├── api.py              # APIRouter registration
├── models.py           # SQLAlchemy ORM models (or models/ directory)
├── routes/             # Individual endpoint handlers
│   └── *.py
├── schemas/            # Pydantic request/response models
│   └── *.py
└── services/           # Business logic, integrations
    └── *.py
```

**Module Registration Pattern:**
- Each module exports a router from `api.py`
- Main app includes routers in `backend/main.py`
- Modules are enabled/disabled via `ENABLED_MODULES` environment variable
- All routes automatically prefixed with `/api/v1/{module}`

### Authentication & Authorization

**JWT Token Structure:**
```python
{
  "sub": "user_id (UUID)",
  "email": "user@example.com",
  "modules": ["hr", "it", "tasks"],  # Enabled modules for user
  "roles": {"hr": "admin", "it": "specialist"},  # Per-module roles
  "is_superuser": bool,
  "company_id": "optional",
  "exp": timestamp,
  "iat": timestamp
}
```

**Token Lifetime:**
- Default: 7 days (10080 minutes)
- Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` or `ACCESS_TOKEN_EXPIRE_SECONDS`
- No refresh token mechanism (users must re-login after expiration)
- Frontend checks token expiry every 30 seconds (`App.tsx`)

**Role-Based Access:**
- HR Module: `hr:admin`, `hr:employee`
- IT Module: `it:admin`, `it:specialist`, `it:employee`
- Tasks Module: `tasks:admin`, `tasks:employee`
- Portal Admin: `is_superuser=true` flag

**Key Files:**
- `backend/core/auth.py`: JWT creation/verification, dependencies
- `backend/core/permissions.py`: Role-based access control helpers
- `frontend/src/shared/store/auth.store.ts`: Zustand auth state with token expiry checks

### Database Schema & Migrations

**Database:** PostgreSQL 14+ with SQLAlchemy 2.0 ORM

**Migration Strategy:**
- **Startup migrations** run on every app start (`backend/core/startup_migrations.py`)
- Uses `ALTER TABLE IF NOT EXISTS` for best-effort schema updates
- Alembic exists but not actively used
- All migrations also included in `backend/scripts/init_db.py`

**Core Tables:**
- `users`: Authentication, roles (JSONB), telegram integration fields
- `employees`: HR data, linked to users
- `tickets`: Multi-source tickets (web, email, telegram, rocketchat)
- `equipment`: Inventory with location tracking (room_id, current_owner_id)
- `system_settings`: Key-value configuration for all integrations

**Key Schema Features:**
- All IDs use UUID (except employees use integer)
- Telegram integration: `users.telegram_id`, `telegram_link_code` (6-digit, 10-min expiry)
- Ticket deduplication: `email_message_id`, `rocketchat_message_id`
- Equipment tracking: `equipment_history` table for movements
- Audit trail: `ticket_history` for change tracking

### Integration Architecture

**All integrations use polling** (not webhooks) with configurable intervals stored in `system_settings` table:

**1. Email IMAP (`backend/modules/it/services/email_service.py`):**
- Polls INBOX every `imap_poll_interval` seconds (default: 60)
- Creates tickets from unread emails
- Deduplicates by RFC822 Message-ID
- Maps sender to User by email, falls back to `status="pending_user"`
- Started in `main.py` startup hook as separate asyncio task

**2. Telegram Bot (`backend/modules/it/services/telegram_service.py`):**
- Long-polling with `getUpdates` (timeout=30s)
- Commands: `/start <code>`, `/menu`, `/tickets`
- Account linking via 6-digit code (10-minute expiry)
- Notifications sent to IT specialists on new tickets/assignments
- Can create Tasks from tickets via callback buttons

**3. RocketChat (`backend/modules/it/services/rocketchat_service.py`):**
- Polls `channels.history` or `groups.history` every 10 seconds
- Supports both public channels and private groups
- Deduplicates by message `_id`
- Thread support: messages with `tmid` become comments on existing tickets
- Maps users by `username` (case-insensitive)
- Filters out system messages and bot messages

**4. Zabbix (`backend/modules/it/services/zabbix_service.py`):**
- Currently minimal (GET hosts only)
- Future: auto-create tickets from alerts, sync equipment

**Configuration:**
- All integration settings stored in `system_settings` table
- API: `GET /api/v1/it/settings` (grouped by integration)
- Sensitive values (passwords, tokens) masked as `"********"` in responses
- Test endpoints: `/api/v1/it/settings/test/{integration}`

### Frontend State Management

**Zustand Stores:**

```typescript
// auth.store.ts - Authentication state
{
  user: User | null,
  token: string | null,
  isAuthenticated: boolean,
  login(email, password): Promise<void>,
  logout(): void,
  checkTokenExpiry(): boolean  // Called every 30s
}

// ui.store.ts - UI state
{
  sidebarOpen: boolean,
  theme: "dark" | "light"
}
```

**API Client (`frontend/src/shared/api/client.ts`):**
- Automatic Bearer token injection from localStorage
- Auto-logout on 401 responses
- Base URL: `/api/v1`
- Helper functions: `apiGet`, `apiPost`, `apiPatch`, `apiPut`, `apiDelete`

**Routing (`frontend/src/App.tsx`):**
- Protected routes require authentication
- Module routes decode JWT to verify module access
- Portal admin routes check `is_superuser` flag
- Token expiry checked every 30 seconds via `setInterval`

## Common Development Tasks

### Adding a New Integration

1. Create service in `backend/modules/it/services/{integration}_service.py`:
   - Implement `start_polling()` and `stop_polling()` methods
   - Add singleton instance at module level

2. Add settings schema in `backend/modules/it/schemas/settings.py`

3. Create route in `backend/modules/it/routes/{integration}.py` with test endpoint

4. Register route in `backend/modules/it/api.py`

5. Add startup/shutdown hooks in `backend/main.py`

6. Add frontend UI in `frontend/src/modules/it/pages/SettingsPage.tsx`

### Adding a New Ticket Source

1. Add source type to `Ticket` model (e.g., `source="whatsapp"`)

2. Create service with polling logic and ticket creation

3. Add deduplication field (e.g., `whatsapp_message_id`)

4. Add migration in `startup_migrations.py` and `scripts/init_db.py`

5. Add icon/badge in frontend `TicketsPage.tsx`

### Adding a New Module

1. Create module structure:
   ```
   backend/modules/{module}/
   ├── __init__.py
   ├── api.py
   ├── models.py
   ├── routes/
   └── schemas/
   ```

2. Register in `backend/main.py`:
   ```python
   if "{module}" in settings.get_enabled_modules():
       from backend.modules.{module} import api as module_api
       app.include_router(module_api.router)
   ```

3. Create frontend structure:
   ```
   frontend/src/modules/{module}/
   ├── pages/
   └── components/
   ```

4. Update `.env`: `ENABLED_MODULES=hr,it,tasks,{module}`

5. Add module routes in `frontend/src/App.tsx` with `ModuleRoute` wrapper

### Modifying Database Schema

**For new columns:**
1. Add field to SQLAlchemy model
2. Add migration function to `backend/core/startup_migrations.py`
3. Add same migration to `backend/scripts/init_db.py`
4. Restart backend (migration runs automatically)

**For new tables:**
1. Create SQLAlchemy model
2. Import model in `backend/scripts/init_db.py`
3. Run `python scripts/init_db.py` or restart backend

### Working with System Settings

**Backend:**
```python
from backend.modules.hr.services.settings_service import SettingsService

settings_service = SettingsService(db)
value = settings_service.get_setting("telegram_bot_token")
settings_service.update_setting("telegram_bot_enabled", "true")
```

**Frontend:**
```typescript
// GET /api/v1/it/settings returns grouped settings
const settings = await apiGet<SettingsResponse>("/it/settings")

// PUT /api/v1/it/settings/{key}
await apiPut(`/it/settings/${key}`, { value: "..." })
```

**Sensitive Keys:** Automatically masked in API responses (passwords, tokens, API keys)

## Important Implementation Details

### Token Expiry Issue

**IMPORTANT:** In `docker-compose.yml` and `docker-compose.prod.yml`, ensure:
```yaml
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # NOT 30
```
Setting this to 30 minutes causes users to be logged out frequently.

### Password Hashing

- Uses bcrypt (not MD5/SHA)
- Passwords truncated to 72 bytes (bcrypt limitation)
- Implemented in `backend/core/auth.py` via `get_password_hash()`

### Polling Performance

**Recommended intervals:**
- Email IMAP: 60-300 seconds
- Telegram: Long-polling with 30s timeout (no additional sleep)
- RocketChat: 10 seconds (can increase to reduce load)

**Database connection pooling:**
```python
pool_size=5
max_overflow=10
pool_recycle=3600  # 1 hour
```

### Cross-Module Linking

- Tasks can link to Tickets via `Task.linked_ticket_id`
- Tickets can reference Employees via `Ticket.employee_id`
- Equipment can be assigned to Employees via `Equipment.current_owner_id`
- All use proper foreign keys with `ON DELETE SET NULL` or `CASCADE`

### LLM Integration (Knowledge Core)

- Uses OpenRouter API (configurable model)
- Features: Article normalization, ticket resolution suggestions
- Qdrant for semantic search with embeddings
- Configurable via `system_settings`: `llm_normalization_enabled`, `openrouter_api_key`, `openrouter_model`

## Testing & Debugging

**Backend API Docs:**
- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

**View Logs:**
```bash
# Backend
docker-compose logs -f backend | grep "Email\|Telegram\|RocketChat"

# All services
docker-compose logs -f
```

**Check Integration Status:**
- Email: Look for `[Email] Polling запущен` in logs
- Telegram: Look for `[Telegram] Polling запущен`
- RocketChat: Look for `[RocketChat] Polling запущен`

**Common Issues:**
- **Users logged out frequently:** Check `ACCESS_TOKEN_EXPIRE_MINUTES` in docker-compose
- **Email tickets not created:** Verify IMAP settings, use App Password for Gmail
- **Telegram bot not responding:** Check token with `curl https://api.telegram.org/bot<TOKEN>/getMe`
- **RocketChat tickets not created:** Ensure bot is member of channel, check User ID and Auth Token

## Security Considerations

- JWT secret must be min 32 characters
- All passwords hashed with bcrypt
- Sensitive settings automatically masked in API responses
- CORS configured via `CORS_ORIGINS` environment variable (default: `*` for dev)
- No rate limiting implemented (recommended for production)

## Deployment

**Production Checklist:**
1. Set strong `SECRET_KEY` (min 32 chars)
2. Configure `DATABASE_URL` with production credentials
3. Set `ACCESS_TOKEN_EXPIRE_MINUTES=10080` (not 30)
4. Configure `CORS_ORIGINS` to allowed domains
5. Set `ENABLED_MODULES` to required modules
6. Configure integrations via `system_settings` table after first login

**Nginx Configuration:**
- Frontend: `/` → `frontend:80`
- Backend API: `/api` → `backend:8000`
- Static uploads: `/uploads` → `backend:8000/uploads`

**Database Initialization:**
```bash
docker-compose exec backend python scripts/init_db.py
```
Creates tables, seed admin, and dictionaries.

## Reference Documentation

- Full architecture: `ARCHITECTURE.md` (comprehensive, in Russian)
- Deployment: `DEPLOYMENT.md`, `QUICK_DEPLOY.md`
- Pre-deployment checklist: `CHECK_BEFORE_DEPLOY.md`
- API documentation: http://localhost:8000/api/v1/docs (when running)
