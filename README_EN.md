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

### 4. Start the Server

```bash
python main.py
```

Access the service at `http://localhost:8080`

### 5. Login to Admin Panel

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
├── main.py              # FastAPI entry point
├── config.py           # Configuration
├── database.py         # Database operations
├── models.py           # Data models
├── private.py          # ⚠️ Sensitive config (create manually, do NOT commit to git)
├── generate_keys.py    # RSA key generation script
├── requirements.txt    # Python dependencies
├── routers/           # API routes
│   ├── admin.py       # Admin endpoints
│   ├── license.py     # License endpoints
│   └── projects.py    # Project endpoints
├── src/               # Frontend source
│   ├── pages/         # React pages
│   └── ...
└── logs/              # Log directory
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

MIT License
