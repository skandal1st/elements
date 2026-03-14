# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elements Platform is a modular corporate automation platform. Backend: FastAPI (Python 3.11+). Frontend: React 19 + TypeScript + Vite. Database: PostgreSQL 14+ with SQLAlchemy 2.0. Styling: Tailwind CSS.

**Modules:** HR (employees, org structure, LDAP/AD), IT (helpdesk tickets, equipment, integrations), Tasks (projects, kanban boards), Knowledge Core (LLM-powered KB with Qdrant), Documents (internal document workflow, .docx templates, approval routes), Portal (dashboard/aggregation), Finance (placeholder).

## Development Commands

### Backend

```bash
# From backend/ directory
pip install -r requirements.txt
python scripts/init_db.py          # Initialize DB, seed admin (admin@elements.local / admin123)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# API docs: http://localhost:8000/api/v1/docs

# Run tests (minimal test suite in backend/tests/)
pytest tests/
```

### Frontend

```bash
# From frontend/ directory
npm install
npm run dev       # Dev server on http://localhost:5173 (proxies /api and /uploads to backend)
npm run build     # tsc -b && vite build → dist/
npm run lint      # ESLint
```

No test framework is configured for frontend. Backend has minimal integration tests in `backend/tests/` (run with `pytest`).

### Docker

```bash
docker-compose up -d                              # Dev: PostgreSQL, Redis, RabbitMQ, MinIO, Qdrant
docker-compose -f docker-compose.prod.yml up -d   # Production
docker-compose exec backend python scripts/init_db.py  # Init DB in Docker
```

### Required Environment Variables

See `.env.example`. Key vars:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` (alias: `SECRET_KEY`) - min 32 chars, generate with `openssl rand -hex 32`
- `REDIS_URL` - Redis connection string
- `ENABLED_MODULES` - comma-separated list: `hr,it,tasks,documents`
- `LICENSE_SERVER_URL`, `COMPANY_ID` - License server config
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` - Initial admin credentials (created by `init_db.py`)

**Important:** `ACCESS_TOKEN_EXPIRE_MINUTES=10080` (7 days). Setting this to 30 causes frequent logouts.

## Architecture

### Module System

Backend modules follow this structure:

```
backend/modules/{module}/
├── api.py          # APIRouter (mounted in main.py)
├── models.py       # SQLAlchemy models (or models/ directory)
├── routes/         # Endpoint handlers
├── schemas/        # Pydantic request/response models
└── services/       # Business logic, integrations
```

**Module registration:** All module routers are unconditionally imported and included in `backend/main.py`. The `ENABLED_MODULES` env var controls feature availability at runtime, not router mounting.

Routes are prefixed with `/api/v1/{module}`. Auth routes are in `backend/core/auth_routes.py`.

**Available modules:**
- `hr` - Employee management, org structure, LDAP sync, documents
- `it` - Tickets, equipment, knowledge base, integrations (Telegram, RocketChat, Email IMAP, Zabbix)
- `tasks` - Projects and task boards
- `documents` - Document workflow with .docx templates and approval routes
- `portal` - Aggregated dashboard
- `finance` - Placeholder (not implemented)

### Frontend Structure

```
frontend/src/
├── App.tsx              # All routing (ProtectedRoute, ModuleRoute, PortalAdminRoute wrappers)
├── pages/               # LoginPage, ProfilePage
├── modules/             # hr/, it/, tasks/, settings/, portal/
│   └── {module}/pages/  # Module page components
└── shared/
    ├── api/client.ts    # API client (auto Bearer token, auto-logout on 401)
    ├── store/           # Zustand stores (auth, ui, tasks)
    ├── components/      # Layout (Sidebar, Header), auth, notifications
    └── services/        # API service layer
```

**Path alias:** `@` → `src/` (configured in `vite.config.ts`).

**Key libraries:** Zustand (state), TanStack React Query (server state), TanStack React Table, React Hook Form + Zod (forms/validation), React Router DOM v7, Recharts (charts), date-fns, Lucide icons, @hello-pangea/dnd (drag-and-drop).

### Authentication & Authorization

- JWT with HS256 (`backend/core/auth.py`), bcrypt password hashing
- Token contains: `sub` (user UUID), `email`, `modules` (list), `roles` (per-module dict), `is_superuser`
- Per-module RBAC roles: `{module}:admin`, `{module}:specialist`, `{module}:employee`
- Frontend: Zustand auth store (`auth.store.ts`) checks token expiry every 30s
- API client auto-injects Bearer token, auto-logouts on 401

### Database & Migrations

- **No active Alembic usage.** Schema changes go through:
  1. Add field to SQLAlchemy model
  2. Add `ALTER TABLE IF NOT EXISTS` migration to `backend/core/startup_migrations.py`
  3. Add same migration to `backend/scripts/init_db.py`
  4. Restart backend (startup migrations run automatically)
- All IDs use UUID (except employees use integer)
- Core tables: `users`, `employees`, `tickets`, `equipment`, `system_settings`

### Integration Architecture

All integrations use **polling** (not webhooks). Started in `main.py` on_startup:

- **Telegram Bot:** Long-polling via `getUpdates` — started on startup
- **RocketChat:** Polls channel history every ~10s — started on startup
- **Email IMAP:** Polling service exists (`email_service.py`) but NOT started in `main.py` startup hook
- **Zabbix:** Minimal (GET hosts only)

Configuration stored in `system_settings` DB table. API: `GET /api/v1/it/settings`. Sensitive values masked as `"********"` in responses.

### Static Files & Uploads

- **Upload directory:** `uploads/` (configurable via `UPLOAD_DIR` env var)
- **Mounted in backend:** `app.mount("/uploads", StaticFiles(...))` in `main.py`
- **Subdirectories:** Auto-served (e.g., `/uploads/tickets/`, `/uploads/documents/`)
- **Frontend proxy:** Vite dev server proxies `/uploads` → backend (see `vite.config.ts`)
- **File URLs in DB:** Store as `/uploads/{subdir}/{filename}`, served directly by backend/nginx

### Knowledge Core & LLM Integration

- **Vector DB:** Qdrant for semantic search (config: `QDRANT_URL`, `QDRANT_COLLECTION`)
- **LLM Provider:** OpenRouter (config: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`)
- **Optional features:** Both disabled by default
  - `LLM_NORMALIZATION_ENABLED=false` - LLM-powered content normalization
  - `LLM_SUGGESTIONS_ENABLED=false` - AI suggestions
- **System is fully functional with LLM features disabled**

### Other Top-Level Directories

- `license-server/` — License management service (separate app)
- `shared/` — Shared Python and TypeScript utilities
- `nginx/` — Nginx configuration for production
- `scripts/` — Database and deployment scripts
- `deploy.sh`, `backup.sh` — Deployment and backup scripts

## Key Files Reference

| Purpose | File |
|---------|------|
| App entry & module mounting | `backend/main.py` |
| App config (all env vars) | `backend/core/config.py` |
| JWT & password auth | `backend/core/auth.py` |
| RBAC helpers | `backend/core/permissions.py` |
| Startup migrations | `backend/core/startup_migrations.py` |
| DB init & seed | `backend/scripts/init_db.py` |
| Frontend routing | `frontend/src/App.tsx` |
| API client | `frontend/src/shared/api/client.ts` |
| Auth state | `frontend/src/shared/store/auth.store.ts` |
| Vite config & proxy | `frontend/vite.config.ts` |
