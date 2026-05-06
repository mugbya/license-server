import aiosqlite
from typing import Optional, List
from datetime import datetime, timedelta
import hashlib
import secrets
import base64
import json
import uuid
import logging

# Import from config
from config import (
    DATABASE_PATH,
    LICENSE_PRIVATE_KEY,
    YEAR_LICENSE_DAYS,
    TRIAL_LICENSE_UNIT,
    TRIAL_LICENSE_VALUE,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_ADMIN_PASSWORD
)

# Logger for this module
logger = logging.getLogger("license_server")

# Try to import bcrypt, fall back to SHA256 if not available
try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False
    logger.warning("bcrypt not available, using SHA256 (not recommended for production)")

# Validate that LICENSE_PRIVATE_KEY is set
if LICENSE_PRIVATE_KEY is None:
    raise RuntimeError(
        "LICENSE_PRIVATE_KEY not configured. "
        "Please create private.py with LICENSE_PRIVATE_KEY set to RSA private key."
    )

try:
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

# Load RSA private key
_private_key = None
if HAS_CRYPTO and LICENSE_PRIVATE_KEY:
    try:
        _private_key = load_pem_private_key(
            LICENSE_PRIVATE_KEY.encode(),
            password=None,
            backend=default_backend()
        )
    except Exception as e:
        logger.error(f"Failed to load private key: {e}")
        _private_key = None


def hash_password(password: str) -> str:
    """Hash password using bcrypt (if available) or SHA256 with salt (fallback)"""
    if HAS_BCRYPT:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    else:
        # Fallback: Use SHA256 with random salt (less secure, but works without bcrypt)
        salt = secrets.token_hex(16)
        return f"{salt}${hashlib.sha256((salt + password).encode()).hexdigest()}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash.

    Supports two password formats:
    1. New format: bcrypt(SHA256(original_password)) - for passwords sent as SHA256 from frontend
    2. Legacy format: bcrypt(original_password) - for original passwords

    Detection:
    - If stored hash starts with '$2' and is valid bcrypt, try both verification methods
    - If verification fails as SHA256->bcrypt, try direct bcrypt (legacy)
    """
    if HAS_BCRYPT:
        # Check if it's a bcrypt hash (starts with $2)
        if password_hash.startswith('$2'):
            # First try: verify as SHA256(password) -> bcrypt (new format)
            try:
                password_sha256 = hashlib.sha256(password.encode('utf-8')).hexdigest()
                if bcrypt.checkpw(password_sha256.encode('utf-8'), password_hash.encode('utf-8')):
                    return True
            except Exception:
                pass

            # Second try: verify as original password (legacy format)
            try:
                if bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                    return True
            except Exception:
                pass

            return False
        # Legacy SHA256 format (plain hash stored directly)
        try:
            return hashlib.sha256(password.encode('utf-8')).hexdigest() == password_hash
        except Exception:
            return False
    else:
        # Fallback for SHA256 with salt format: salt$hash
        if '$' in password_hash:
            salt, stored_hash = password_hash.split('$', 1)
            return hashlib.sha256((salt + password).encode()).hexdigest() == stored_hash
        # Legacy format (plain SHA256 hash) - for backwards compatibility
        return hashlib.sha256(password.encode()).hexdigest() == password_hash


def generate_license_key(license_type: str) -> str:
    """Generate a random license key (short format) with type-specific prefix.

    Format: GLY-XXXX-XXXX-XXXX-XXXX (4 groups of 4 chars)
    This is the "许可证" that customers receive via email.
    """
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


def encode_auth_code(license_key: str, license_type: str, expires_at: str = None, start_at: str = None, jti: str = None) -> str:
    """Encode authorization code in JWT format (RS256).

    This creates the "授权码" that clients use for local verification.
    Format: GLY-{base64url(header)}.base64url(payload).base64url(signature)}
    JWT Payload contains: {"exp": timestamp, "jti": uuid, "start_at": datetime}

    Args:
        license_key: The short license key (GLY-XXXX-XXXX-XXXX-XXXX)
        license_type: Type of license (year/trial/custom/permanent)
        expires_at: Expiration datetime string (None for permanent)
        start_at: Activation datetime string (None = current time)
        jti: JWT ID for unique identification (None = auto generate uuid)

    Returns:
        Encoded auth code string in JWT format
    """
    global _private_key

    if not HAS_CRYPTO or _private_key is None:
        raise RuntimeError("Cryptography not available")

    # Calculate expiration timestamp (0 means permanent)
    exp_timestamp = 0
    if expires_at:
        exp_timestamp = int(datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S").timestamp())
    elif license_type == "permanent":
        exp_timestamp = 0

    # Use provided jti or generate new one
    if jti is None:
        jti = str(uuid.uuid4())

    # Use provided start_at or current time
    if start_at is None:
        start_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Build JWT header
    header = {
        "alg": "RS256",
        "typ": "JWT"
    }

    # Build JWT payload
    payload = {
        "exp": exp_timestamp,
        "jti": jti,
        "start_at": start_at
    }

    # Encode header and payload as base64url
    header_b64 = base64.urlsafe_b64encode(json.dumps(header, separators=(',', ':')).encode()).decode().rstrip('=')
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload, separators=(',', ':')).encode()).decode().rstrip('=')

    # Create signing input
    signing_input = f"{header_b64}.{payload_b64}"

    # Sign with RSA private key (RS256 = RSA SHA256)
    signature = _private_key.sign(
        signing_input.encode(),
        padding.PKCS1v15(),
        hashes.SHA256()
    )

    # Encode signature as base64url
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip('=')

    # Get prefix
    prefix_map = {
        'year': 'GLY',
        'trial': 'GLT',
        'custom': 'GLC',
        'permanent': 'GLP'
    }
    prefix = prefix_map.get(license_type, 'GLY')

    # Format: GLY-{header}.{payload}.{signature}
    return f"{prefix}-{header_b64}.{payload_b64}.{signature_b64}"


def decode_auth_code(encoded: str) -> Optional[dict]:
    """Decode and verify authorization code in JWT format (RS256).

    This decodes the "授权码" to get exp, jti, start_at.
    Format: GLY-{header}.{payload}.{signature}

    Args:
        encoded: The encoded auth code

    Returns:
        Dict with exp, jti, start_at or None if invalid
    """
    global _private_key

    if not encoded:
        return None

    if not HAS_CRYPTO or _private_key is None:
        return None

    # Extract prefix and JWT parts
    prefix_found = None
    for prefix in ("GLY-", "GLT-", "GLC-", "GLP-"):
        if encoded.startswith(prefix):
            prefix_found = prefix[:-1]
            break

    if not prefix_found:
        return None

    try:
        # Get JWT part (after prefix)
        jwt_part = encoded[len(prefix_found) + 1:]

        # Split into header.payload.signature
        parts = jwt_part.split('.')
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}"
        signature = base64.urlsafe_b64decode(signature_b64 + '==')

        public_key = _private_key.public_key()
        public_key.verify(
            signature,
            signing_input.encode(),
            padding.PKCS1v15(),
            hashes.SHA256()
        )

        # Decode payload
        payload_json = base64.urlsafe_b64decode(payload_b64 + '==')
        data = json.loads(payload_json)

        return {
            "exp": data.get("exp", 0),
            "jti": data.get("jti", ""),
            "start_at": data.get("start_at", "")
        }
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
                bound INTEGER DEFAULT 0,
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

        # Add bound column if it doesn't exist (for existing databases)
        try:
            await db.execute("ALTER TABLE license_keys ADD COLUMN bound INTEGER DEFAULT 0")
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

        # Usage records table (aggregated by machine_code)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS usage_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project TEXT NOT NULL DEFAULT 'zupu',
                machine_code TEXT NOT NULL UNIQUE,
                public_ip TEXT,
                country TEXT,
                region TEXT,
                city TEXT,
                app_version TEXT,
                os_name TEXT,
                os_version TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Usage detail table (location change history)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS usage_detail (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project TEXT NOT NULL DEFAULT 'zupu',
                machine_code TEXT NOT NULL,
                public_ip TEXT,
                country TEXT,
                region TEXT,
                city TEXT,
                os_name TEXT,
                os_version TEXT,
                changed_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Add columns to usage_records for existing databases
        try:
            await db.execute("ALTER TABLE usage_records ADD COLUMN app_version TEXT")
        except:
            pass
        try:
            await db.execute("ALTER TABLE usage_records ADD COLUMN os_name TEXT")
        except:
            pass
        try:
            await db.execute("ALTER TABLE usage_records ADD COLUMN os_version TEXT")
        except:
            pass

        # Add columns to usage_detail for existing databases
        try:
            await db.execute("ALTER TABLE usage_detail ADD COLUMN os_name TEXT")
        except:
            pass
        try:
            await db.execute("ALTER TABLE usage_detail ADD COLUMN os_version TEXT")
        except:
            pass

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
                # For new installations, use the new format: bcrypt(SHA256(password))
                # This is because frontend now sends SHA256 hashed passwords
                password_sha256 = hashlib.sha256(DEFAULT_ADMIN_PASSWORD.encode('utf-8')).hexdigest()
                await db.execute(
                    "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
                    (DEFAULT_ADMIN_USERNAME, hash_password(password_sha256))
                )

        await db.commit()


async def get_license_by_key(license_key: str) -> Optional[dict]:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            """SELECT id, license_key, license_type, machine_code, bound, activated_at, expires_at, revoked, created_at, updated_at
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
                "bound": row[4],
                "activated_at": row[5],
                "expires_at": row[6],
                "revoked": row[7],
                "created_at": row[8],
                "updated_at": row[9]
            }
        return None


async def get_trial_by_machine_code(machine_code: str) -> Optional[dict]:
    """Get trial license for a specific machine code"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            """SELECT id, license_key, license_type, machine_code, bound, activated_at, expires_at, revoked, created_at, updated_at
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
                "bound": row[4],
                "activated_at": row[5],
                "expires_at": row[6],
                "revoked": row[7],
                "created_at": row[8],
                "updated_at": row[9]
            }
        return None


async def activate_license(license_key: str, machine_code: str) -> dict:
    """Activate a license key using the short license code.

    The license_key here is the short format (GLY-XXXX-XXXX-XXXX-XXXX).
    Server generates the auth code after activation.
    """
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Get license by short key
        license = await get_license_by_key(license_key)

        if not license:
            return {"success": False, "error": "授权码无效"}

        if license["revoked"]:
            return {"success": False, "error": "授权码已被撤销"}

        if license["machine_code"] and license["machine_code"] != machine_code:
            return {"success": False, "error": "授权码已被其他机器使用"}

        # Calculate expires_at based on license type
        activated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        expires_at = license["expires_at"]

        if license["license_type"] == "year":
            expires_at = (datetime.now() + timedelta(days=YEAR_LICENSE_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
        elif license["license_type"] == "trial":
            expires_at = (datetime.now() + timedelta(minutes=get_trial_minutes())).strftime("%Y-%m-%d %H:%M:%S")
        # permanent and custom types keep their original expires_at

        # Generate auth code with RSA encryption
        auth_code = encode_auth_code(license_key, license["license_type"], expires_at, activated_at)

        # Unbind any other licenses bound to this machine (for the same project)
        # This ensures one machine can only have one active binding at a time
        # Only update bound status, keep machine_code for record tracking
        project = license.get("project", "zupu")
        await db.execute(
            """UPDATE license_keys
               SET bound = 0, updated_at = datetime('now')
               WHERE machine_code = ? AND project = ? AND bound = 1 AND license_key != ?""",
            (machine_code, project, license_key)
        )

        # Bind this license to the machine
        await db.execute(
            """UPDATE license_keys
               SET machine_code = ?, activated_at = ?, expires_at = ?, bound = 1, updated_at = datetime('now')
               WHERE license_key = ?""",
            (machine_code, activated_at, expires_at, license_key)
        )
        await db.commit()

        return {
            "success": True,
            "license_type": license["license_type"],
            "activated_at": activated_at,
            "expires_at": expires_at,
            "license_key": license_key,  # Short format for display
            "auth_code": auth_code  # RSA encoded for client verification
        }


async def verify_license(machine_code: str, license_key: str) -> dict:
    """Verify license status by short license key"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        license = await get_license_by_key(license_key)

        if not license:
            return {"valid": False, "error": "授权码无效"}

        if license["revoked"]:
            return {"valid": False, "error": "授权码已被撤销"}

        if not license.get("bound"):
            return {"valid": False, "error": "授权码已解绑"}

        if license["machine_code"] != machine_code:
            return {"valid": False, "error": "授权码与机器不匹配"}

        # Check expiry
        if license["expires_at"]:
            expires_dt = datetime.strptime(license["expires_at"], "%Y-%m-%d %H:%M:%S")
            if expires_dt < datetime.now():
                return {"valid": False, "error": "授权已过期"}

        # Generate auth code for client
        auth_code = encode_auth_code(license_key, license["license_type"], license["expires_at"], license["activated_at"])

        return {
            "valid": True,
            "license_type": license["license_type"],
            "expires_at": license["expires_at"],
            "auth_code": auth_code
        }


async def create_license_key(license_type: str, project: str = "zupu", expires_at: str = None) -> dict:
    """Create a new license key (short format) and store in database.

    This is called when admin generates a license in the admin panel.
    Returns the short license key (GLY-XXXX-XXXX-XXXX-XXXX) and auth_code.
    """
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Generate short license key
        license_key = generate_license_key(license_type)

        # Check if key already exists
        existing = await get_license_by_key(license_key)
        if existing:
            return {"success": False, "error": "授权码已存在"}

        # Calculate expires_at if not provided
        final_expires_at = expires_at
        if not final_expires_at:
            if license_type == "year":
                final_expires_at = (datetime.now() + timedelta(days=YEAR_LICENSE_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
            elif license_type == "trial":
                final_expires_at = (datetime.now() + timedelta(minutes=get_trial_minutes())).strftime("%Y-%m-%d %H:%M:%S")
            elif license_type == "permanent":
                final_expires_at = None  # 永久授权没有到期时间

        # Generate auth_code for this license (未激活状态下生成，但只在激活时才使用)
        # 这里生成的是预授权码，实际使用时由activate_license重新生成
        auth_code = encode_auth_code(license_key, license_type, final_expires_at)

        await db.execute(
            "INSERT INTO license_keys (license_key, license_type, project, expires_at) VALUES (?, ?, ?, ?)",
            (license_key, license_type, project, final_expires_at)
        )
        await db.commit()

        return {
            "success": True,
            "license_key": license_key,  # Short format for email/display
            "expires_at": final_expires_at,
            "auth_code": auth_code  # Auth code for display
        }


async def revoke_license(license_key: str) -> dict:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE license_keys SET revoked = 1, updated_at = datetime('now') WHERE license_key = ?",
            (license_key,)
        )
        await db.commit()
        return {"success": True}


async def unbind_license(license_key: str) -> dict:
    """Unbind a license by clearing machine_code and bound flag"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE license_keys SET machine_code = NULL, bound = 0, activated_at = NULL, updated_at = datetime('now') WHERE license_key = ?",
            (license_key,)
        )
        await db.commit()
        return {"success": True}


async def delete_license_key(id: int) -> dict:
    """Delete a license key completely by ID"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM license_keys WHERE id = ?", (id,))
        await db.commit()
        return {"success": True}


async def get_all_license_keys(project: str = None, page: int = 1, page_size: int = 20) -> dict:
    """Get license keys with pagination, optionally filtered by project"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        offset = (page - 1) * page_size

        # Get total count
        if project:
            async with db.execute(
                "SELECT COUNT(*) FROM license_keys WHERE project = ?",
                (project,)
            ) as cursor:
                total = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT id, license_key, license_type, project, machine_code, bound, activated_at, expires_at, revoked, created_at, updated_at
                   FROM license_keys WHERE project = ? ORDER BY created_at DESC LIMIT ? OFFSET ?""",
                (project, page_size, offset)
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute("SELECT COUNT(*) FROM license_keys") as cursor:
                total = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT id, license_key, license_type, project, machine_code, bound, activated_at, expires_at, revoked, created_at, updated_at
                   FROM license_keys ORDER BY created_at DESC LIMIT ? OFFSET ?""",
                (page_size, offset)
            ) as cursor:
                rows = await cursor.fetchall()

        result = []
        for r in rows:
            license_key = r[1]
            license_type = r[2]
            expires_at = r[7]

            if r[6]:
                auth_code = encode_auth_code(license_key, license_type, expires_at, r[6])
            else:
                auth_code = encode_auth_code(license_key, license_type, expires_at)

            result.append({
                "id": r[0],
                "license_key": license_key,
                "license_type": license_type,
                "project": r[3],
                "machine_code": r[4],
                "bound": bool(r[5]),
                "activated_at": r[6],
                "expires_at": expires_at,
                "revoked": bool(r[8]),
                "created_at": r[9],
                "updated_at": r[10],
                "auth_code": auth_code
            })
        return {"data": result, "total": total}


async def get_license_key_stats(project: str = None) -> dict:
    """Get license key statistics"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Total keys
        if project:
            async with db.execute("SELECT COUNT(*) FROM license_keys WHERE project = ?", (project,)) as cursor:
                total_keys = (await cursor.fetchone())[0]
            async with db.execute("SELECT COUNT(*) FROM license_keys WHERE project = ? AND bound = 1", (project,)) as cursor:
                activated_keys = (await cursor.fetchone())[0]
            async with db.execute("SELECT COUNT(*) FROM license_keys WHERE project = ? AND revoked = 1", (project,)) as cursor:
                revoked_keys = (await cursor.fetchone())[0]
            async with db.execute("SELECT license_type, COUNT(*) as count FROM license_keys WHERE project = ? GROUP BY license_type", (project,)) as cursor:
                by_type = await cursor.fetchall()
            by_project = []
        else:
            async with db.execute("SELECT COUNT(*) FROM license_keys") as cursor:
                total_keys = (await cursor.fetchone())[0]
            async with db.execute("SELECT COUNT(*) FROM license_keys WHERE bound = 1") as cursor:
                activated_keys = (await cursor.fetchone())[0]
            async with db.execute("SELECT COUNT(*) FROM license_keys WHERE revoked = 1") as cursor:
                revoked_keys = (await cursor.fetchone())[0]
            async with db.execute("SELECT license_type, COUNT(*) as count FROM license_keys GROUP BY license_type") as cursor:
                by_type = await cursor.fetchall()
            async with db.execute("SELECT project, COUNT(*) as count FROM license_keys GROUP BY project") as cursor:
                by_project = await cursor.fetchall()

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
    """Save batch usage reports with dedup logic.

    Logic:
    - First report (machine_code not found) -> insert into both tables
    - Subsequent report:
        - IP changed or location changed -> update usage_records + insert usage_detail
        - Same -> do nothing
    """
    count = 0
    async with aiosqlite.connect(DATABASE_PATH) as db:
        for report in reports:
            project = report.get("project", "zupu")
            machine_code = report.get("machine_code", "")
            public_ip = report.get("public_ip", "")
            country = report.get("country", "")
            region = report.get("region", "")
            city = report.get("city", "")
            app_version = report.get("app_version", "")
            os_name = report.get("os_name", "")
            os_version = report.get("os_version", "")

            if not machine_code:
                continue

            # Check if record exists in usage_records (by machine_code only)
            async with db.execute(
                "SELECT id, public_ip, country, region, city FROM usage_records WHERE machine_code = ?",
                (machine_code,)
            ) as cursor:
                existing = await cursor.fetchone()

            if not existing:
                # First report: insert into both tables
                await db.execute(
                    """INSERT INTO usage_records (project, machine_code, public_ip, country, region, city, app_version, os_name, os_version)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (project, machine_code, public_ip, country, region, city, app_version, os_name, os_version)
                )
                await db.execute(
                    """INSERT INTO usage_detail (project, machine_code, public_ip, country, region, city, os_name, os_version)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (project, machine_code, public_ip, country, region, city, os_name, os_version)
                )
                count += 1
            else:
                # Check if IP changed or location changed
                old_ip = existing[1]
                old_country, old_region, old_city = existing[2], existing[3], existing[4]
                ip_changed = (public_ip != old_ip)
                location_changed = (country != old_country or region != old_region or city != old_city)

                if ip_changed or location_changed:
                    # Update usage_records + insert usage_detail
                    await db.execute(
                        """UPDATE usage_records SET public_ip = ?, country = ?, region = ?, city = ?, app_version = ?, os_name = ?, os_version = ?, updated_at = datetime('now')
                           WHERE machine_code = ?""",
                        (public_ip, country, region, city, app_version, os_name, os_version, machine_code)
                    )
                    await db.execute(
                        """INSERT INTO usage_detail (project, machine_code, public_ip, country, region, city, os_name, os_version)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (project, machine_code, public_ip, country, region, city, os_name, os_version)
                    )
                    count += 1
                # else: same record, do nothing

        await db.commit()
        return {"success": True, "count": count}


async def get_usage_stats(project: str = None, page: int = 1, page_size: int = 20) -> dict:
    """Get usage statistics from new tables, optionally filtered by project with pagination"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Statistics by address triplet fields (Top 10 + Other)
        def aggregate_top10(data):
            if len(data) <= 10:
                return data
            top10 = data[:10]
            others_sum = sum(r[1] for r in data[10:])
            if others_sum > 0:
                top10.append(('其他', others_sum))
            return top10

        offset = (page - 1) * page_size

        if project:
            async with db.execute("SELECT COUNT(*) FROM usage_records WHERE project = ?", (project,)) as cursor:
                total_machines = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT COUNT(*) FROM usage_records WHERE project = ?""",
                (project,)
            ) as cursor:
                total_count = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT country, COUNT(*) as count FROM usage_records WHERE project = ? AND country != ''
                   GROUP BY country ORDER BY count DESC LIMIT 11""",
                (project,)
            ) as cursor:
                by_country_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT region, COUNT(*) as count FROM usage_records WHERE project = ? AND region != ''
                   GROUP BY region ORDER BY count DESC LIMIT 11""",
                (project,)
            ) as cursor:
                by_region_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT city, COUNT(*) as count FROM usage_records WHERE project = ? AND city != ''
                   GROUP BY city ORDER BY count DESC LIMIT 11""",
                (project,)
            ) as cursor:
                by_city_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT machine_code, public_ip, country, region, city, app_version, os_name, os_version, updated_at
                   FROM usage_records WHERE project = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?""",
                (project, page_size, offset)
            ) as cursor:
                recent_records = await cursor.fetchall()
        else:
            async with db.execute("SELECT COUNT(*) FROM usage_records") as cursor:
                total_machines = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT COUNT(*) FROM usage_records"""
            ) as cursor:
                total_count = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT country, COUNT(*) as count FROM usage_records WHERE country != ''
                   GROUP BY country ORDER BY count DESC LIMIT 11"""
            ) as cursor:
                by_country_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT region, COUNT(*) as count FROM usage_records WHERE region != ''
                   GROUP BY region ORDER BY count DESC LIMIT 11"""
            ) as cursor:
                by_region_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT city, COUNT(*) as count FROM usage_records WHERE city != ''
                   GROUP BY city ORDER BY count DESC LIMIT 11"""
            ) as cursor:
                by_city_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT machine_code, public_ip, country, region, city, app_version, os_name, os_version, updated_at
                   FROM usage_records ORDER BY updated_at DESC LIMIT ? OFFSET ?""",
                (page_size, offset)
            ) as cursor:
                recent_records = await cursor.fetchall()

        by_country = aggregate_top10(by_country_raw)
        by_region = aggregate_top10(by_region_raw)
        by_city = aggregate_top10(by_city_raw)

        # Statistics by app_version, os (combined name + version)
        if project:
            async with db.execute(
                """SELECT app_version, COUNT(*) as count FROM usage_records WHERE project = ? AND app_version != ''
                   GROUP BY app_version ORDER BY count DESC LIMIT 11""",
                (project,)
            ) as cursor:
                by_app_version_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT CASE
                      WHEN os_version IS NOT NULL AND os_version != '' THEN os_name || ' ' || os_version
                      ELSE os_name
                   END as os_full, COUNT(*) as count
                   FROM usage_records WHERE project = ? AND os_name != ''
                   GROUP BY os_full ORDER BY count DESC LIMIT 11""",
                (project,)
            ) as cursor:
                by_os_raw = await cursor.fetchall()
        else:
            async with db.execute(
                """SELECT app_version, COUNT(*) as count FROM usage_records WHERE app_version != ''
                   GROUP BY app_version ORDER BY count DESC LIMIT 11"""
            ) as cursor:
                by_app_version_raw = await cursor.fetchall()
            async with db.execute(
                """SELECT CASE
                      WHEN os_version IS NOT NULL AND os_version != '' THEN os_name || ' ' || os_version
                      ELSE os_name
                   END as os_full, COUNT(*) as count
                   FROM usage_records WHERE os_name != ''
                   GROUP BY os_full ORDER BY count DESC LIMIT 11"""
            ) as cursor:
                by_os_raw = await cursor.fetchall()

        by_app_version = aggregate_top10(by_app_version_raw)
        by_os = aggregate_top10(by_os_raw)

        return {
            "total_machines": total_machines,
            "total_count": total_count,
            "by_country": [{"name": r[0], "value": r[1]} for r in by_country],
            "by_region": [{"name": r[0], "value": r[1]} for r in by_region],
            "by_city": [{"name": r[0], "value": r[1]} for r in by_city],
            "by_app_version": [{"name": r[0], "value": r[1]} for r in by_app_version],
            "by_os": [{"name": r[0], "value": r[1]} for r in by_os],
            "recent_records": [
                {
                    "machine_code": r[0],
                    "public_ip": r[1],
                    "country": r[2],
                    "region": r[3],
                    "city": r[4],
                    "app_version": r[5],
                    "os_name": r[6],
                    "os_version": r[7],
                    "updated_at": r[8]
                }
                for r in recent_records
            ],
            "page": page,
            "page_size": page_size,
            "total": total_count
        }


async def get_usage_detail_records(project: str = None, page: int = 1, page_size: int = 20) -> dict:
    """Get usage detail records, optionally filtered by project with pagination"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        offset = (page - 1) * page_size

        if project:
            async with db.execute(
                "SELECT COUNT(*) FROM usage_detail WHERE project = ?",
                (project,)
            ) as cursor:
                total = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT id, project, machine_code, public_ip, country, region, city, os_name, os_version, changed_at
                   FROM usage_detail WHERE project = ? ORDER BY changed_at DESC LIMIT ? OFFSET ?""",
                (project, page_size, offset)
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute(
                "SELECT COUNT(*) FROM usage_detail"
            ) as cursor:
                total = (await cursor.fetchone())[0]
            async with db.execute(
                """SELECT id, project, machine_code, public_ip, country, region, city, os_name, os_version, changed_at
                   FROM usage_detail ORDER BY changed_at DESC LIMIT ? OFFSET ?""",
                (page_size, offset)
            ) as cursor:
                rows = await cursor.fetchall()

        return {"data": [
            {
                "id": r[0],
                "project": r[1],
                "machine_code": r[2],
                "public_ip": r[3],
                "country": r[4],
                "region": r[5],
                "city": r[6],
                "os_name": r[7],
                "os_version": r[8],
                "changed_at": r[9]
            }
            for r in rows
        ], "total": total}


async def delete_usage_record(machine_code: str) -> dict:
    """Delete usage record by machine code"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Delete from usage_records
        await db.execute("DELETE FROM usage_records WHERE machine_code = ?", (machine_code,))
        # Delete related detail records
        await db.execute("DELETE FROM usage_detail WHERE machine_code = ?", (machine_code,))
        await db.commit()
        return {"success": True}


async def delete_usage_detail(id: int) -> dict:
    """Delete usage detail record by id"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM usage_detail WHERE id = ?", (id,))
        await db.commit()
        return {"success": True}


async def verify_admin(username: str, password: str) -> Optional[dict]:
    """Verify admin credentials, returns user info if valid"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute(
            "SELECT id, username, password_hash FROM admin_users WHERE username = ?",
            (username,)
        ) as cursor:
            row = await cursor.fetchone()
            if row and verify_password(password, row[2]):
                return {"id": row[0], "username": row[1]}
        return None


async def change_admin_password(username: str, current_password: str, new_password: str) -> dict:
    """Change admin password"""
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
