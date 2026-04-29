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
TRIAL_LICENSE_UNIT = "minute"   # 时间单位: day/hour/minute
TRIAL_LICENSE_VALUE = 3       # 试用期数值

# RSA Private Key for license signing (2048-bit)
# Import from private.py - DO NOT commit private.py to git
try:
    from private import LICENSE_PRIVATE_KEY, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD
except ImportError:
    LICENSE_PRIVATE_KEY = None  # Must be set in private.py
    DEFAULT_ADMIN_USERNAME = "admin"
    DEFAULT_ADMIN_PASSWORD = "admin123"
