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

### 2. Generate RSA Keys (Important)

**Run `generate_keys.py` to automatically generate keys and create `private.py`**:

```bash
python generate_keys.py
```

The script will automatically:
- Generate RSA 2048-bit key pair
- Create `backend/private.py` with JWT_SECRET, default admin credentials, and private key
- Output the public key for client embedding

**Important: Please modify the following in `backend/private.py`:**
- `JWT_SECRET`: Change to a random string in production
- `DEFAULT_ADMIN_PASSWORD`: Change after first login

### 3. Start Backend Server

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Access the service at `http://localhost:8080`

### 4. Login to Admin Panel

Default credentials: `admin` / `admin123` (change after first login)

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



---



## Nginx Reverse Proxy Deployment

Use Nginx as the unified entry point for frontend static files and backend API.

### Install Nginx

```bash
sudo apt install nginx
```

### Deploy Configuration

```bash
# Copy Nginx config
sudo cp deploy/nginx/license-server.conf /etc/nginx/sites-available/license-server

# Enable site
sudo ln -s /etc/nginx/sites-available/license-server /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Build Frontend

```bash
cd /opt/license-server/frontend
npm install
npm run build
```

### Access

- HTTP: `http://server-ip/`
- API: `http://server-ip/api/`

### HTTPS Setup

Using Let's Encrypt free certificate:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured
```

## GitHub Auto Deploy

Automatically deploy to server when code is pushed to main branch.

### 1. Configure GitHub Secrets

Add in GitHub repository Settings → Secrets and variables → Actions:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `SERVER_HOST` | Server IP | `123.45.67.89` |
| `SERVER_USER` | SSH username | `ubuntu` |
| `SERVER_PASSWORD` | SSH password or key | `your-password` |
| `SERVER_PORT` | SSH port | `22` |

### 2. Server Setup

```bash
# Install basic tools (CentOS/Rocky)
sudo yum install -y git

# Install Node.js 18.x (for building frontend)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
node --version  # Verify version

# Create directory
sudo mkdir -p /opt/license-server

# Initialize git repo (if not already)
cd /opt/license-server
git init
git remote add origin https://github.com/your-username/license-server.git
git pull origin main

# Run deployment script manually once
cd deploy/systemd
chmod +x setup.sh manage.sh
sudo ./setup.sh
```

### 3. Push to Trigger Deploy

```bash
git add .
git commit -m "update"
git push origin main
```

Check GitHub Actions page for deployment progress.

### 4. Manual Trigger

Go to GitHub repository Actions → "Deploy to Server" → "Run workflow"

## License Code Format

### Two codes generated simultaneously

| Name | Format | Purpose | Delivery |
|------|--------|---------|----------|
| **license_key** | `GLY-XXXX-XXXX-XXXX-XXXX` | Customer activation | Email/SMS |
| **auth_code** | `GLY-{header}.{payload}.{signature}` | Client local verification | Returned on activation |

### license_key Format
```
GLY-XXXX-XXXX-XXXX-XXXX
```
- `GLY`: Yearly license
- `GLT`: Trial license
- `GLC`: Custom license
- `GLP`: Permanent license

### auth_code Format (JWT RS256)
```
GLY-eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE3MDk4MzIwMDAsImp0aSI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTUxMjM0NTY3ODkwIn0.SIGNATURE
```
Contains expiration time, JTI (unique ID), and activation time.

### Authorization Flow

```
1. Server generates → license_key + auth_code (simultaneously)

2. Server sends license_key to customer (email/SMS)

3. Customer calls /api/license/activate(license_key, machine_code)

4. Server returns auth_code to client

5. Client decodes auth_code with public key, checks exp timestamp
```

## Usage Flow

```
1. Login to admin panel
2. Project Management → Create project (e.g., "My Software A")
3. Switch to target project in the top selector
4. Generate License → Select license type → System generates both license_key and auth_code
5. Send license_key to customer (email/SMS)
6. Customer activates software with license_key, server returns auth_code
7. Client uses public key to verify auth_code, checks expiration
```

## Project Structure

```
license-server/
├── .github/                      # GitHub configuration
│   └── workflows/
│       └── deploy.yml            # Auto-deploy workflow
├── backend/                     # Backend directory
│   ├── main.py                   # FastAPI entry point
│   ├── config.py                # Configuration
│   ├── database.py              # Database operations
│   ├── models.py                # Data models
│   ├── private.py               # ⚠️ Sensitive config (auto-generated by generate_keys.py, do NOT commit to git)
│   ├── requirements.txt         # Python dependencies
│   ├── gunicorn.conf.py         # Gunicorn configuration
│   └── routers/                 # API routes
│       ├── admin.py             # Admin endpoints
│       ├── license.py           # License endpoints
│       └── projects.py          # Project endpoints
├── frontend/                     # Frontend directory
│   ├── src/                     # React source
│   │   └── pages/               # React pages
│   ├── index.html
│   ├── package.json
│   └── ...
├── deploy/                       # Deployment configuration
│   ├── systemd/                 # Systemd deployment
│   │   ├── setup.sh             # Setup script
│   │   └── manage.sh            # Management script
│   └── nginx/                    # Nginx configuration
│       ├── license-server.conf   # HTTP config
│       └── license-server-ssl.conf # HTTPS config
├── generate_keys.py              # RSA key generation script
├── docker-compose.yml            # Docker deployment config
├── README.md
└── README_EN.md
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
