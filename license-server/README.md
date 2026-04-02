# Elements Platform License Server

License validation server for Elements Platform. Manages companies, licenses, and validates license requests from Elements instances.

## Features

- **License Validation**: Validates licenses for Elements Platform instances
- **Hardware Binding**: Optional hardware ID binding for licenses
- **Edition Support**: Separate licenses for Core and Enterprise editions
- **Module Control**: Define which modules are available per license
- **Activation Logging**: Tracks all license validation attempts
- **Admin API**: Full CRUD for companies and licenses

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Installation

1. Clone the repository

2. Create `.env` file:
```bash
cp .env.example .env
nano .env  # Edit with your values
```

3. Start services:
```bash
docker-compose up -d
```

4. Check health:
```bash
curl http://localhost:8001/health
```

5. Access API documentation:
```
http://localhost:8001/api/v1/docs
```

## API Endpoints

### Public Endpoints

**POST /api/v1/license/validate**
- Validates a license
- Used by Elements instances
- No authentication required

**GET /api/v1/license/modules/{company_id}**
- Returns available modules for a company
- No authentication required

### Admin Endpoints

All admin endpoints require `X-API-Key` header with `ADMIN_API_KEY` value.

**Companies:**
- POST /api/v1/admin/companies - Create company
- GET /api/v1/admin/companies - List companies
- GET /api/v1/admin/companies/{id} - Get company
- PATCH /api/v1/admin/companies/{id} - Update company
- DELETE /api/v1/admin/companies/{id} - Delete company

**Licenses:**
- POST /api/v1/admin/licenses - Create license (auto-generates key)
- GET /api/v1/admin/licenses - List licenses
- GET /api/v1/admin/licenses/{id} - Get license
- PATCH /api/v1/admin/licenses/{id} - Update license
- PATCH /api/v1/admin/licenses/{id}/revoke - Revoke license
- PATCH /api/v1/admin/licenses/{id}/activate - Activate license

## Usage Examples

### Create Company

```bash
curl -X POST http://localhost:8001/api/v1/admin/companies \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  -d '{
    "name": "Acme Corporation",
    "email": "admin@acme.com",
    "contact_name": "John Doe",
    "contact_email": "john@acme.com"
  }'
```

### Create License

```bash
curl -X POST http://localhost:8001/api/v1/admin/licenses \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  -d '{
    "company_id": "uuid-from-create-company",
    "edition": "core",
    "modules": ["portal", "hr", "it"],
    "features": {},
    "max_users": 100,
    "max_instances": 1,
    "expires_at": "2026-12-31T23:59:59Z",
    "bind_hardware": false,
    "allowed_hardware_ids": []
  }'
```

### Validate License (from Elements instance)

```bash
curl -X POST http://localhost:8001/api/v1/license/validate \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid",
    "hardware_id": "hardware-id-hash",
    "edition": "core",
    "version": "1.0.0"
  }'
```

## License Key Format

License keys are auto-generated with format:

```
ELEM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
```

Where:
- `ELEM`: Prefix
- `CORE/ENTP`: Edition code
- 5 blocks: Random hex characters
- Last block: Checksum

Example: `ELEM-CORE-A3F2-B8C1-D5E7-F4A9-8B3C-E2D5`

## Database Schema

### Companies Table
- id (UUID, primary key)
- name (string)
- email (string, unique)
- contact_name (string, optional)
- contact_email (string, optional)
- status (active/suspended/cancelled)
- created_at (timestamp)

### Licenses Table
- id (UUID, primary key)
- company_id (UUID, foreign key)
- license_key (string, unique)
- edition (core/enterprise)
- modules (JSONB array)
- features (JSONB object)
- max_users (integer, nullable)
- max_instances (integer)
- issued_at (timestamp)
- expires_at (timestamp)
- status (active/expired/revoked)
- bind_hardware (boolean)
- allowed_hardware_ids (JSONB array)

### Activations Table
- id (UUID, primary key)
- license_id (UUID, foreign key)
- hardware_id (string)
- instance_version (string)
- ip_address (inet)
- result (success/failed/expired/revoked)
- error_message (text)
- checked_at (timestamp)

## Configuration

All configuration via environment variables in `.env`:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: JWT secret key (32+ chars)
- `ADMIN_API_KEY`: API key for admin endpoints
- `PORT`: Server port (default: 8001)

## Monitoring

**Health Check:**
```bash
curl http://localhost:8001/health
```

**Logs:**
```bash
docker-compose logs -f license-server
```

**Database Access:**
```bash
docker-compose exec postgres psql -U license_server -d licenses
```

## Backup

Backup database regularly:

```bash
docker-compose exec -T postgres pg_dump -U license_server licenses > backup.sql
```

Restore:
```bash
cat backup.sql | docker-compose exec -T postgres psql -U license_server licenses
```

## Security

1. **Change default passwords** in `.env`
2. **Set strong ADMIN_API_KEY**
3. **Use HTTPS** in production (reverse proxy with SSL)
4. **Restrict CORS** origins in production
5. **Firewall rules**: Only allow Elements instances to access port 8001
6. **Regular backups** of database

## Troubleshooting

**Database connection errors:**
- Check `DATABASE_URL` in `.env`
- Verify postgres container is running: `docker-compose ps`

**Admin API returns 403:**
- Check `X-API-Key` header matches `ADMIN_API_KEY` in `.env`

**License validation fails:**
- Check company exists and is active
- Verify license exists and not expired
- Check edition matches
- Review activation logs in database

## Support

For issues with License Server:
- Check logs: `docker-compose logs -f`
- Review API documentation: http://localhost:8001/api/v1/docs
- Contact: license@elements.io
