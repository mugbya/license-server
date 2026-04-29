import aiosqlite
from typing import Optional, List
from datetime import datetime, timedelta
import hashlib
import json
import hmac
import secrets

# Import from config
from config import DATABASE_PATH, LICENSE_SECRET_KEY, YEAR_LICENSE_DAYS, TRIAL_LICENSE_UNIT, TRIAL_LICENSE_VALUE

# Validate that LICENSE_SECRET_KEY is set
if LICENSE_SECRET_KEY is None:
    raise RuntimeError(
        "LICENSE_SECRET_KEY not configured. "
        "Please create private.py with LICENSE_SECRET_KEY set to a 32-byte string."
    )

try:
    from Crypto.Cipher import AES
    import base64
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

# Default admin credentials (username: admin, password: admin123)
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"


def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_license_key(license_type: str) -> str:
    """Generate a random license key with type-specific prefix"""
    prefix_map = {
        'year': 'GLY',      # 年度授权
        'trial': 'GLT',     # 试用授权
        'custom': 'GLC',    # 自定义授权
        'permanent': 'GLP'  # 永久授权
    }
    prefix = prefix_map.get(license_type, 'GLY')
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    part = lambda: ''.join(secrets.choice(chars) for _ in range(4))
    return f"{prefix}-{part()}-{part()}-{part()}-{part()}"


def get_trial_minutes() -> int:
    """Convert trial license unit and value to total minutes"""
    unit = TRIAL_LICENSE_UNIT.lower()
    value = TRIAL_LICENSE_VALUE
    if unit == "day":
        return value * 24 * 60
    elif unit == "hour":
        return value * 60
    elif unit == "minute":
        return value
    return value  # default to value as minutes


def encode_license(license_key: str, license_type: str, expires_at: str = None) -> str:
    """Encode license info into encrypted license code with format GLY-{base64}"""
    if not HAS_CRYPTO:
        # Fallback without encryption (not secure, only for development)
        return license_key

    # Calculate expiration timestamp
    exp_timestamp = 0
    if expires_at:
        exp_timestamp = int(datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S").timestamp())
    elif license_type == "permanent":
        exp_timestamp = 0  # 0 means permanent

    # Build data structure
    data = {
        "key": license_key,
        "type": license_type,
        "exp": exp_timestamp
    }

    # Calculate HMAC signature for integrity
    json_str = json.dumps(data, separators=(',', ':'))
    sig = hmac.new(
        LICENSE_SECRET_KEY.encode(),
        json_str.encode(),
        hashlib.sha256
    ).hexdigest()
    data["sig"] = sig

    # AES-GCM encryption
    json_str = json.dumps(data, separators=(',', ':'))
    cipher = AES.new(LICENSE_SECRET_KEY.encode()[:32], AES.MODE_GCM)
    ciphertext, nonce = cipher.encrypt_and_digest(json_str.encode())

    # Encode as base64 with GLY- prefix
    encoded = base64.b64encode(nonce + ciphertext).decode()
    return f"GLY-{encoded}"


def decode_license(encoded: str) -> Optional[dict]:
    """Decode and verify license code. Returns license data or None if invalid."""
    if not encoded:
        return None

    if not encoded.startswith(("GLY-", "GLT-", "GLC-", "GLP-")):
        # Not an encrypted license, return None to indicate invalid format
        return None

    if not HAS_CRYPTO:
        return None

    try:
        encrypted = base64.b64decode(encoded[4:])
        nonce = encrypted[:16]
        ciphertext = encrypted[16:]

        cipher = AES.new(LICENSE_SECRET_KEY.encode()[:32], AES.MODE_GCM, nonce=nonce)
        json_str = cipher.decrypt_and_verify(ciphertext, cipher.digest).decode()
        data = json.loads(json_str)

        # Verify signature
        sig = data.pop("sig", None)
        if not sig:
            return None

        json_data = json.dumps(data, separators=(',', ':'))
        expected_sig = hmac.new(
            LICENSE_SECRET_KEY.encode(),
            json_data.encode(),
            hashlib.sha256
        ).hexdigest()

        if sig != expected_sig:
            return None

        return data
    except Exception:
        return None


async def init_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Admin users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # License keys table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS license_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT NOT NULL UNIQUE,
                license_type TEXT NOT NULL,
                project TEXT NOT NULL DEFAULT 'zupu',
                machine_code TEXT,
                activated_at TEXT,
                expires_at TEXT,
                revoked INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Add project column if it doesn't exist (for existing databases)
        try:
            await db.execute("ALTER TABLE license_keys ADD COLUMN project TEXT NOT NULL DEFAULT 'zupu'")
        except:
            pass

        # Usage logs table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                machine_code TEXT NOT NULL,
                action TEXT NOT NULL,
                license_key TEXT,
                ip_address TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Usage reports table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS usage_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project TEXT NOT NULL DEFAULT 'zupu',
                app_version TEXT NOT NULL,
                os_name TEXT NOT NULL,
                os_version TEXT NOT NULL,
                public_ip TEXT,
                country TEXT,
                region TEXT,
                city TEXT,
                report_date TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Add project column if it doesn't exist (for existing databases)
        try:
            await db.execute("ALTER TABLE usage_reports ADD COLUMN project TEXT NOT NULL DEFAULT 'zupu'")
        except:
            pass

        # Projects table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                disabled INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Create default admin user if not exists
        async with db.execute(
            "SELECT id FROM admin_users WHERE username = ?",
            (DEFAULT_ADMIN_USERNAME,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                await db.execute(
                    "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
                    (DEFAULT_ADMIN_USERNAME, hash_password(DEFAULT_ADMIN_PASSWORD))
                )

        await db.commit()


async def get_license_by_key(license_key: str) -> Optional[dict]:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            """SELECT id, license_key, license_type, machine_code, activated_at, expires_at, revoked, created_at, updated_at
               FROM license_keys WHERE license_key = ?""",
            (license_key,)
        ) as cursor:
            row = await cursor.fetchone()

        if row:
            return {
                "id": row[0],
                "license_key": row[1],
                "license_type": row[2],
                "machine_code": row[3],
                "activated_at": row[4],
                "expires_at": row[5],
                "revoked": row[6],
                "created_at": row[7],
                "updated_at": row[8]
            }
        return None


async def get_trial_by_machine_code(machine_code: str) -> Optional[dict]:
    """Get trial license for a specific machine code"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            """SELECT id, license_key, license_type, machine_code, activated_at, expires_at, revoked, created_at, updated_at
               FROM license_keys WHERE machine_code = ? AND license_type = 'trial'""",
            (machine_code,)
        ) as cursor:
            row = await cursor.fetchone()

        if row:
            return {
                "id": row[0],
                "license_key": row[1],
                "license_type": row[2],
                "machine_code": row[3],
                "activated_at": row[4],
                "expires_at": row[5],
                "revoked": row[6],
                "created_at": row[7],
                "updated_at": row[8]
            }
        return None


async def activate_license(license_key: str, machine_code: str) -> dict:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Try to decode license if it's in the encrypted format (GLY-...)
        original_key = license_key
        decoded_info = None

        if license_key.startswith(("GLY-", "GLT-", "GLC-", "GLP-")):
            decoded_info = decode_license(license_key)
            if decoded_info:
                original_key = decoded_info["key"]
                # Verify the license type matches
                stored_license = await get_license_by_key(original_key)
                if stored_license and stored_license["license_type"] != decoded_info.get("type"):
                    return {"success": False, "error": "授权码类型不匹配"}
            # If decoding fails, still try with original key (plain format)

        # Get the license key info - try decoded key first, then try as-is
        license = None

        # If we decoded successfully, try the decoded key first
        if decoded_info:
            license = await get_license_by_key(original_key)

        # If not found or wasn't encoded, try with the key as-is
        if not license:
            license = await get_license_by_key(license_key)
            if license:
                original_key = license_key

        if not license:
            return {"success": False, "error": "授权码无效"}

        if license["revoked"]:
            return {"success": False, "error": "授权码已被撤销"}

        if license["machine_code"] and license["machine_code"] != machine_code:
            return {"success": False, "error": "授权码已被其他机器使用"}

        # Calculate expires_at based on license type (only for types that need calculation)
        activated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        expires_at = license["expires_at"]  # Preserve existing expires_at (e.g., for custom type)

        if license["license_type"] == "year":
            expires_at = (datetime.now() + timedelta(days=YEAR_LICENSE_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
        elif license["license_type"] == "trial":
            expires_at = (datetime.now() + timedelta(minutes=get_trial_minutes())).strftime("%Y-%m-%d %H:%M:%S")
        # permanent and custom types keep their original expires_at

        await db.execute(
            """UPDATE license_keys
               SET machine_code = ?, activated_at = ?, expires_at = ?, updated_at = datetime('now')
               WHERE license_key = ?""",
            (machine_code, activated_at, expires_at, original_key)
        )
        await db.commit()

        return {
            "success": True,
            "license_type": license["license_type"],
            "activated_at": activated_at,
            "expires_at": expires_at
        }


async def verify_license(machine_code: str, license_key: str) -> dict:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Decode license if it's in the new encrypted format
        original_key = license_key
        encoded_exp = None  # Expiry from encoded license for validation

        if license_key.startswith(("GLY-", "GLT-", "GLC-", "GLP-")):
            decoded = decode_license(license_key)
            if decoded:
                original_key = decoded["key"]
                # Get expiry from encoded license (0 means permanent)
                encoded_exp = decoded.get("exp", 0)
                # If encoded expiry is 0, it's permanent; otherwise it's a timestamp
                if encoded_exp == 0:
                    encoded_exp = None  # Permanent
            # If decoding fails, we'll try the key as-is below

        # Verify specific license key - try decoded key first, then key as-is
        license = await get_license_by_key(original_key)
        if not license:
            # Try with key as-is (in case it was stored unencrypted or decoding failed)
            license = await get_license_by_key(license_key)
            if license:
                original_key = license_key

        if not license:
            return {"valid": False, "error": "授权码无效"}

        if license["revoked"]:
            return {"valid": False, "error": "授权码已被撤销"}

        if license["machine_code"] != machine_code:
            return {"valid": False, "error": "授权码与机器不匹配"}

        # Check expiry from encoded license first (more secure)
        if encoded_exp is not None:
            # encoded_exp is a Unix timestamp
            if encoded_exp > 0 and encoded_exp < datetime.now().timestamp():
                return {"valid": False, "error": "授权已过期"}
        elif license["expires_at"]:
            # Fallback to database expiry
            expires_dt = datetime.strptime(license["expires_at"], "%Y-%m-%d %H:%M:%S")
            if expires_dt < datetime.now():
                return {"valid": False, "error": "授权已过期"}

        return {
            "valid": True,
            "license_type": license["license_type"],
            "expires_at": license["expires_at"]
        }


async def create_license_key(license_key: str, license_type: str, project: str = "zupu", expires_at: str = None) -> dict:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Check if key already exists
        existing = await get_license_by_key(license_key)
        if existing:
            return {"success": False, "error": "授权码已存在"}

        # If custom expires_at is provided, use it; otherwise calculate based on license_type
        final_expires_at = expires_at
        if not final_expires_at:
            if license_type == "year":
                final_expires_at = (datetime.now() + timedelta(days=YEAR_LICENSE_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
            elif license_type == "trial":
                final_expires_at = (datetime.now() + timedelta(minutes=get_trial_minutes())).strftime("%Y-%m-%d %H:%M:%S")
            elif license_type == "permanent":
                final_expires_at = None  # 永久授权没有到期时间

        await db.execute(
            "INSERT INTO license_keys (license_key, license_type, project, expires_at) VALUES (?, ?, ?, ?)",
            (license_key, license_type, project, final_expires_at)
        )
        await db.commit()

        # Encode the license key with expiry embedded
        encoded_key = encode_license(license_key, license_type, final_expires_at)

        return {"success": True, "expires_at": final_expires_at, "encoded_key": encoded_key}


async def revoke_license(license_key: str) -> dict:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE license_keys SET revoked = 1, updated_at = datetime('now') WHERE license_key = ?",
            (license_key,)
        )
        await db.commit()
        return {"success": True}


async def get_all_license_keys(project: str = None) -> List[dict]:
    """Get all license keys, optionally filtered by project"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        if project:
            async with db.execute(
                """SELECT id, license_key, license_type, project, machine_code, activated_at, expires_at, revoked, created_at, updated_at
                   FROM license_keys WHERE project = ? ORDER BY created_at DESC""",
                (project,)
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute(
                """SELECT id, license_key, license_type, project, machine_code, activated_at, expires_at, revoked, created_at, updated_at
                   FROM license_keys ORDER BY created_at DESC"""
            ) as cursor:
                rows = await cursor.fetchall()

        return [
            {
                "id": r[0],
                "license_key": r[1],
                "license_type": r[2],
                "project": r[3],
                "machine_code": r[4],
                "activated_at": r[5],
                "expires_at": r[6],
                "revoked": bool(r[7]),
                "created_at": r[8],
                "updated_at": r[9]
            }
            for r in rows
        ]


async def get_license_key_stats(project: str = None) -> dict:
    """Get license key statistics"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        project_filter = f"WHERE project = '{project}'" if project else ""

        # Total keys
        async with db.execute(f"SELECT COUNT(*) FROM license_keys {project_filter}") as cursor:
            total_keys = (await cursor.fetchone())[0]

        # Activated keys
        async with db.execute(f"SELECT COUNT(*) FROM license_keys {project_filter} AND machine_code IS NOT NULL") as cursor:
            activated_keys = (await cursor.fetchone())[0]

        # Revoked keys
        async with db.execute(f"SELECT COUNT(*) FROM license_keys {project_filter} AND revoked = 1") as cursor:
            revoked_keys = (await cursor.fetchone())[0]

        # By license type
        async with db.execute(
            f"""SELECT license_type, COUNT(*) as count
               FROM license_keys {project_filter}
               GROUP BY license_type"""
        ) as cursor:
            by_type = await cursor.fetchall()

        # By project (if no project filter)
        if not project:
            async with db.execute(
                """SELECT project, COUNT(*) as count
                   FROM license_keys
                   GROUP BY project"""
            ) as cursor:
                by_project = await cursor.fetchall()
        else:
            by_project = []

        return {
            "total": total_keys,
            "activated": activated_keys,
            "revoked": revoked_keys,
            "by_type": [{"type": r[0], "count": r[1]} for r in by_type],
            "by_project": [{"project": r[0], "count": r[1]} for r in by_project]
        }


async def log_usage(machine_code: str, action: str, license_key: str = None, ip_address: str = None):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "INSERT INTO usage_logs (machine_code, action, license_key, ip_address) VALUES (?, ?, ?, ?)",
            (machine_code, action, license_key, ip_address)
        )
        await db.commit()


async def save_usage_reports(reports: List[dict]) -> dict:
    """Save batch usage reports to database"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        for report in reports:
            await db.execute(
                """INSERT INTO usage_reports
                   (project, app_version, os_name, os_version, public_ip, country, region, city, report_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    report.get("project", "zupu"),
                    report.get("app_version", ""),
                    report.get("os_name", ""),
                    report.get("os_version", ""),
                    report.get("public_ip", ""),
                    report.get("country", ""),
                    report.get("region", ""),
                    report.get("city", ""),
                    report.get("report_date", "")
                )
            )
        await db.commit()
        return {"success": True, "count": len(reports)}


async def get_usage_stats(project: str = None) -> dict:
    """Get usage statistics, optionally filtered by project"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Build project filter
        project_filter = f"WHERE project = '{project}'" if project else ""

        # Total reports count
        async with db.execute(f"SELECT COUNT(*) FROM usage_reports {project_filter}") as cursor:
            total_reports = (await cursor.fetchone())[0]

        # Reports by date
        async with db.execute(
            f"""SELECT report_date, COUNT(*) as count
               FROM usage_reports {project_filter}
               GROUP BY report_date
               ORDER BY report_date DESC
               LIMIT 30"""
        ) as cursor:
            reports_by_date = await cursor.fetchall()

        # Reports by country
        async with db.execute(
            f"""SELECT country, COUNT(*) as count
               FROM usage_reports {project_filter}
               GROUP BY country
               ORDER BY count DESC
               LIMIT 10"""
        ) as cursor:
            reports_by_country = await cursor.fetchall()

        # Recent reports
        async with db.execute(
            f"""SELECT project, app_version, os_name, os_version, public_ip, country, region, city, report_date, created_at
               FROM usage_reports {project_filter}
               ORDER BY created_at DESC
               LIMIT 50"""
        ) as cursor:
            recent_reports = await cursor.fetchall()

        return {
            "total_reports": total_reports,
            "reports_by_date": [{"date": r[0], "count": r[1]} for r in reports_by_date],
            "reports_by_country": [{"country": r[0], "count": r[1]} for r in reports_by_country],
            "recent_reports": [
                {
                    "project": r[0],
                    "app_version": r[1],
                    "os_name": r[2],
                    "os_version": r[3],
                    "public_ip": r[4],
                    "country": r[5],
                    "region": r[6],
                    "city": r[7],
                    "report_date": r[8],
                    "created_at": r[9]
                }
                for r in recent_reports
            ]
        }


async def verify_admin(username: str, password: str) -> Optional[dict]:
    """Verify admin credentials, returns user info if valid"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            "SELECT id, username FROM admin_users WHERE username = ? AND password_hash = ?",
            (username, hash_password(password))
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return {"id": row[0], "username": row[1]}
        return None


async def change_admin_password(username: str, current_password: str, new_password: str) -> dict:
    """Change admin password"""
    # First verify current password
    user = await verify_admin(username, current_password)
    if not user:
        return {"success": False, "error": "当前密码错误"}

    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE username = ?",
            (hash_password(new_password), username)
        )
        await db.commit()
        return {"success": True}


# Project CRUD operations
async def get_all_projects() -> List[dict]:
    """Get all projects"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            "SELECT id, name, code, disabled, created_at, updated_at FROM projects ORDER BY created_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
        return [
            {
                "id": r[0],
                "name": r[1],
                "code": r[2],
                "disabled": bool(r[3]),
                "created_at": r[4],
                "updated_at": r[5]
            }
            for r in rows
        ]


async def get_project_by_id(project_id: int) -> Optional[dict]:
    """Get project by ID"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            "SELECT id, name, code, disabled, created_at, updated_at FROM projects WHERE id = ?",
            (project_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "name": row[1],
                "code": row[2],
                "disabled": bool(row[3]),
                "created_at": row[4],
                "updated_at": row[5]
            }
        return None


async def create_project(name: str, code: str) -> dict:
    """Create a new project"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Check if code already exists
        async with db.execute("SELECT id FROM projects WHERE code = ?", (code,)) as cursor:
            if await cursor.fetchone():
                return {"success": False, "error": "项目编码已存在"}

        await db.execute(
            "INSERT INTO projects (name, code) VALUES (?, ?)",
            (name, code)
        )
        await db.commit()
        return {"success": True}


async def update_project(project_id: int, name: str, code: str, disabled: bool) -> dict:
    """Update a project"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Check if code already exists for other project
        async with db.execute("SELECT id FROM projects WHERE code = ? AND id != ?", (code, project_id)) as cursor:
            if await cursor.fetchone():
                return {"success": False, "error": "项目编码已被其他项目使用"}

        await db.execute(
            "UPDATE projects SET name = ?, code = ?, disabled = ?, updated_at = datetime('now') WHERE id = ?",
            (name, code, 1 if disabled else 0, project_id)
        )
        await db.commit()
        return {"success": True}


async def delete_project(project_id: int) -> dict:
    """Delete a project"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Check if project has license keys
        async with db.execute("SELECT COUNT(*) FROM license_keys WHERE project = (SELECT code FROM projects WHERE id = ?)", (project_id,)) as cursor:
            count = (await cursor.fetchone())[0]
        if count > 0:
            return {"success": False, "error": "该项目下存在授权码，无法删除"}

        await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await db.commit()
        return {"success": True}