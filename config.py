import os

# Server configuration
HOST = "0.0.0.0"
PORT = 80

# Database
DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".license_server.db")

# Logging
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
LOG_RETENTION_DAYS = 7  # 日志保留天数
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR

# License defaults
DEFAULT_LICENSE_TYPE = "year"
YEAR_LICENSE_DAYS = 365
TRIAL_LICENSE_DAYS = 30

# License key encryption (32 bytes for AES-256)
# Import from private.py - DO NOT commit private.py to git
try:
    from private import LICENSE_SECRET_KEY
except ImportError:
    LICENSE_SECRET_KEY = None  # Must be set in private.py