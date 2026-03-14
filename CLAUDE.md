# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elements Platform is a modular corporate automation platform. Backend: FastAPI (Python 3.11+). Frontend: React 19 + TypeScript + Vite. Database: PostgreSQL 14+ with SQLAlchemy 2.0. Styling: Tailwind CSS 3. UI language: Russian.

**Modules:** HR (employees, org structure, LDAP/AD), IT (helpdesk tickets, equipment, integrations), Tasks (projects, kanban boards), Knowledge Core (LLM-powered KB with Qdrant, embedded in IT module), Documents (internal document workflow, .docx templates, approval routes), Contracts (counterparties, contracts, acts, INN validation via FNS API), Mail (IMAP/SMTP email client), Portal (dashboard/aggregation), Finance (placeholder).

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
docker-compose up -d                              # Dev: PostgreSQL, Redis, RabbitMQ, MinIO, Qdrant + app services
docker-compose -f docker-compose.prod.yml up -d   # Production: PostgreSQL, Redis, Qdrant, Backend, Frontend, Nginx
docker-compose exec backend python scripts/init_db.py  # Init DB in Docker
```

### Required Environment Variables

See `.env.example` (dev) and `.env.production.example` (prod). Key vars:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` (alias: `SECRET_KEY`) - min 32 chars, generate with `openssl rand -hex 32`
- `REDIS_URL` - Redis connection string
- `ENABLED_MODULES` - comma-separated list: `hr,it,tasks,documents,contracts`
- `LICENSE_SERVER_URL`, `COMPANY_ID` - License server config
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` - Initial admin credentials (created by `init_db.py`)

**Important:** `ACCESS_TOKEN_EXPIRE_MINUTES=10080` (7 days). Setting this to 30 causes frequent logouts.

**Optional integration vars:**
- AD: `AD_SERVER`, `AD_USER`, `AD_PASSWORD`, `AD_BASE_DN`
- Email: `MAILCOW_API_URL`, `MAILCOW_API_KEY`
- LLM: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`
- Vector DB: `QDRANT_URL`, `QDRANT_COLLECTION`
- External: `SUPPORIT_API_URL`, `FNS_API_KEY`

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
- `hr` - Employee management, org structure, LDAP/AD sync, phonebook, birthdays, org tree, ZUP import
- `it` - Tickets (web + email + Telegram sources), equipment tracking with history, consumables, software licenses, buildings/rooms, knowledge base, integrations (Telegram, RocketChat, Email IMAP, Zabbix), reports, dictionaries
- `tasks` - Projects, kanban task boards, checklists, labels, comments, project sharing
- `documents` - Document workflow with versioning, .docx templates, approval routes and workflows, PDF approval sheets (reportlab)
- `contracts` - Counterparties (with INN validation via FNS API), contract types, contracts, acts of completion, funding sources, cost codes
- `mail` - Email client with IMAP/SMTP, folder navigation, attachments, addressbook
- `portal` - Aggregated dashboard, calendar events, announcements, company statistics, birthdays
- `finance` - Placeholder (not implemented)

**Knowledge Core** (embedded in IT module at `/api/v1/it/knowledge`): articles, categories, tags, semantic search via Qdrant, credentials storage, infrastructure registry (physical/virtual servers, network devices).

### Frontend Structure

```
frontend/src/
├── App.tsx              # All routing (ProtectedRoute, ModuleRoute, PortalAdminRoute wrappers)
├── pages/               # LoginPage, ProfilePage
├── modules/             # hr/, it/, tasks/, documents/, contracts/, mail/, settings/, portal/
│   └── {module}/pages/  # Module page components
└── shared/
    ├── api/client.ts    # API client (apiGet, apiPost, apiPatch, apiPut, apiDelete, apiUpload)
    ├── store/           # Zustand stores (auth, ui, tasks)
    ├── components/      # Layout (Sidebar, Header), auth (LoginForm), notifications, RichTextEditor (Tiptap)
    ├── services/        # API service layer (documents, contracts, knowledge, notifications, rooms, equipmentCatalog)
    ├── hooks/           # useDebounce
    └── utils/           # formatRelative (Russian relative dates)
```

**Path alias:** `@` → `src/` (configured in `vite.config.ts`).

**Key libraries:** React 19, React Router DOM v7, Zustand 5 (state), TanStack React Query 5 (server state), TanStack React Table 8, React Hook Form 7 + Zod 4 (forms/validation), Recharts 3 (charts), date-fns 4, Lucide React (icons), @hello-pangea/dnd 18 (drag-and-drop), Tiptap 3 (rich text editor), qrcode.react (QR codes), Tailwind CSS 3.

**Route guards:**
- `ProtectedRoute` — requires valid JWT token
- `ModuleRoute` — checks module in JWT's `modules[]` array (superusers bypass)
- `PortalAdminRoute` — requires `is_superuser: true`

### Authentication & Authorization

- JWT with HS256 (`backend/core/auth.py`), bcrypt password hashing
- Token contains: `sub` (user UUID), `email`, `company_id`, `modules` (list), `roles` (per-module dict), `is_superuser`
- Per-module RBAC roles: `{module}:admin`, `{module}:specialist`, `{module}:employee`
- Route dependencies: `require_module(name)`, `require_role(module, role)`, `require_superuser()`
- License server can override `enabled_modules` per company (Redis cache 300s TTL, fallback to config)
- Frontend: Zustand auth store (`auth.store.ts`) checks token expiry every 30s
- API client auto-injects Bearer token, auto-logouts on 401

### Database & Migrations

- **No active Alembic usage.** Schema changes go through:
  1. Add field to SQLAlchemy model
  2. Add `ALTER TABLE IF NOT EXISTS` migration to `backend/core/startup_migrations.py`
  3. Add same migration to `backend/scripts/init_db.py`
  4. Restart backend (startup migrations run automatically)
- PostgreSQL schemas: `public` (users), `hr` (departments, positions, employees), `it` (equipment, tickets, consumables), `tasks` (projects, tasks), `doc` (documents)
- All IDs use UUID (except employees use integer)
- Automatic `created_at`/`updated_at` timestamps with triggers
- SQL init script: `scripts/init-db.sql` (comprehensive schema with indexes)
- Connection pool: `pool_size=5` (SQLAlchemy engine in `backend/core/database.py`)

### Integration Architecture

All integrations use **polling** (not webhooks). Started in `main.py` on_startup:

| Integration | Method | Interval | Started on startup |
|-------------|--------|----------|-------------------|
| Telegram Bot | Long-polling (`getUpdates`) | Real-time | Yes |
| RocketChat | Channel history polling | ~10s | Yes |
| Email IMAP | Mailbox polling | Configurable | Yes |
| ZUP/1C | REST API | Scheduled | Yes |
| Zabbix | API calls | On-demand | No |
| Active Directory | LDAP queries | On-demand | No |
| FNS API | REST (INN check) | On-demand | No |

Configuration stored in `system_settings` DB table. API: `GET /api/v1/it/settings`. Sensitive values masked as `"********"` in responses.

All startup errors are caught and logged (non-blocking). Shutdown hooks stop all polling services gracefully.

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

### Nginx (Production)

- Reverse proxy for backend (port 8000) and frontend (port 80)
- Rate limiting: API — 10 req/sec (burst 20), login — 5 req/min (burst 3)
- Max client body size: 100MB
- Static file caching: `/uploads/*` — 7-day client cache
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- WebSocket support enabled
- Gzip compression

### Other Top-Level Directories

- `license-server/` — Separate license management service (FastAPI on port 8001, endpoints: check license, list modules, manage subscriptions)
- `shared/` — Shared Python (`elements_common`: JWT, RBAC, event bus, service discovery) and TypeScript (`elements-common`: auth, events) packages
- `nginx/` — Nginx configuration for production (`nginx.conf` + `conf.d/default.conf`)
- `scripts/` — Database init SQL (`init-db.sql`), email check cron (`email-check-cron.sh`), deployment test, data migration
- `supporit/` — Separate legacy IT ticketing app (Node.js/Express + React, migrated from; integration via `supporit_integration.py`)
- `docs/` — Module analysis documentation
- `deploy.sh` — Deployment script (flags: `--prod`, `--migrate`, `--restart`, `--no-build`)
- `backup.sh` — PostgreSQL backup with 30-day retention

### Backend Scripts (`backend/scripts/`)

| Script | Purpose |
|--------|---------|
| `init_db.py` | Database initialization, table creation, seed admin, apply migrations |
| `migrate_add_model_id.py` | Equipment model linking migration |
| `migrate_from_supporit.py` | Data import from legacy SupporIT system |
| `migrate_docs_to_contracts.py` | Migrate documents to contracts module |
| `check_it_specialists.py` | IT team validation |
| `check_recent_tickets.py` | Ticket analytics |

## Key Files Reference

| Purpose | File |
|---------|------|
| App entry & module mounting | `backend/main.py` |
| App config (all env vars) | `backend/core/config.py` |
| JWT & password auth | `backend/core/auth.py` |
| Auth endpoints (login, me) | `backend/core/auth_routes.py` |
| RBAC helpers | `backend/core/permissions.py` |
| DB engine & session | `backend/core/database.py` |
| License client | `backend/core/license.py` |
| Startup migrations | `backend/core/startup_migrations.py` |
| DB init & seed | `backend/scripts/init_db.py` |
| SQL schema init | `scripts/init-db.sql` |
| Frontend routing | `frontend/src/App.tsx` |
| API client | `frontend/src/shared/api/client.ts` |
| Auth state | `frontend/src/shared/store/auth.store.ts` |
| UI state (theme, sidebar) | `frontend/src/shared/store/ui.store.ts` |
| Vite config & proxy | `frontend/vite.config.ts` |
| Nginx reverse proxy | `nginx/conf.d/default.conf` |
