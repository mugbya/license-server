# License Server - Universal License Management System

<!-- Screenshot placeholder -->
<!-- ![License Management Interface] -->

A universal license management system for any software project. Supports multiple license types, machine binding, usage statistics, and project isolation.

## Features

- **Multiple License Types**: Yearly, permanent, custom, and trial licenses
- **Machine Binding**: License codes bound to machine codes with activation/verification
- **JWT Auth Codes**: RSA-signed auth codes that cannot be forged
- **Usage Statistics**: Record and analyze client usage reports
- **Project Management**: Multi-project isolation
- **Logging**: Complete request logs for troubleshooting
- **Universal Design**: Works with any software project

## Requirements

- Python 3.9+
- SQLite 3

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure private.py (Important)

**You must create `private.py`** - copy and modify the following:

```python
# private.py - Sensitive config (do NOT commit to git)

# JWT secret (change in production)
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"

# Default admin credentials (change after first login)
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"

# RSA private key (for auth code signing)
# Run generate_keys.py to generate new keys
LICENSE_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
Paste your private key here
-----END RSA PRIVATE KEY-----"""
```

### 3. Generate RSA Keys (Important)

`generate_keys.py` generates RSA key pairs:
- **Private key**: Saved in `private.py`, used by server to sign auth codes
- **Public key**: Embedded in client software, used to verify auth codes

Run the script:
```bash
python generate_keys.py
```

Paste the private key into `private.py`, embed the public key in your client code.

### 4. Start Backend Server

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Access the service at `http://localhost:8080`

### 5. Start Frontend Server (Development)

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server starts at `http://localhost:9527`

> For production, use `npm run build` to build and deploy

### 6. Login to Admin Panel

<!-- Screenshot placeholder -->
<!-- ![Login Interface] -->

Default credentials: `admin` / `admin123`

## API Endpoints

### License Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/license/create_key` | POST | Create license key |
| `/api/license/activate` | POST | Activate license |
| `/api/license/verify` | POST | Verify license |
| `/api/license/decode` | POST | Decode auth code |
| `/api/license/revoke` | POST | Revoke license |
| `/api/license/keys` | GET | List license keys |
| `/api/license/stats` | GET | Usage statistics |
| `/api/license/trial` | GET | Get trial license |

### Admin

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/login` | POST | Admin login |
| `/api/admin/change_password` | POST | Change password |

### Projects

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/{id}` | PUT/DELETE | Update/delete project |

## Deployment

### Docker Deployment

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down

# Rebuild
docker-compose up -d --build
```

### Systemd + Gunicorn Deployment (Recommended for Tencent Cloud)

For 2 core 2GB servers, use systemd for process management.

**Directory Structure**:
```
/opt/license-server/
├── backend/
│   ├── main.py
│   ├── gunicorn.conf.py
│   ├── logs/
│   └── data/
└── frontend/
```

**Quick Setup**:
```bash
# After uploading code, go to deploy/systemd directory
cd deploy/systemd
chmod +x setup.sh manage.sh
sudo ./setup.sh
```

**Management Commands**:
```bash
cd /opt/license-server/deploy/systemd
sudo ./manage.sh status   # Check status
sudo ./manage.sh logs     # View logs
sudo ./manage.sh restart  # Restart service
sudo ./manage.sh stop     # Stop service
```

## License Code Format

### Short Format (license_key)
```
GLY-XXXX-XXXX-XXXX-XXXX
```
- `GLY`: Yearly license
- `GLT`: Trial license
- `GLC`: Custom license
- `GLP`: Permanent license

### JWT Format (auth_code)
```
GLY-eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE3MDk4MzIwMDAsImp0aSI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTUxMjM0NTY3ODkwIn0.SIGNATURE
```
Contains expiration time, JTI (unique ID), and activation time.

## Usage Flow

```
1. Login to admin panel
2. Project Management → Create project (e.g., "My Software A")
3. Switch to target project in the top selector
4. Generate License → Select license type
5. Send license code to customer
6. Customer activates software with the code
```

## Project Structure

```
license-server/
├── backend/              # Backend directory
│   ├── main.py           # FastAPI entry point
│   ├── config.py        # Configuration
│   ├── database.py      # Database operations
│   ├── models.py        # Data models
│   ├── private.py       # ⚠️ Sensitive config (create manually, do NOT commit to git)
│   ├── requirements.txt  # Python dependencies
│   └── routers/          # API routes
│       ├── admin.py      # Admin endpoints
│       ├── license.py    # License endpoints
│       └── projects.py   # Project endpoints
├── frontend/              # Frontend directory
│   ├── src/              # React source
│   │   └── pages/        # React pages
│   └── ...
├── generate_keys.py       # RSA key generation script
└── logs/                 # Log directory
```

## Configuration

### License Defaults (config.py)

```python
YEAR_LICENSE_DAYS = 365      # Yearly license duration
TRIAL_LICENSE_UNIT = "minute" # Trial time unit: day/hour/minute
TRIAL_LICENSE_VALUE = 3       # Trial duration value
```

### CORS Configuration (main.py)

To restrict browser access, modify `allow_origins`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://your-server-ip:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Security

- **Must create `private.py`** with sensitive configuration
- `private.py` is in `.gitignore` - never commit to version control
- Change default admin password and JWT secret in production
- Use `generate_keys.py` to generate new RSA key pairs
- Use HTTPS for production deployments

## License

Apache License 2.0
