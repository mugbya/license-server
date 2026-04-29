from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers.license import router as license_router
from routers.admin import router as admin_router
from routers.projects import router as projects_router
import uvicorn
import logging
import os
import time
import uuid
from logging.handlers import TimedRotatingFileHandler

# Import config
from config import LOG_DIR, LOG_RETENTION_DAYS, LOG_LEVEL, HOST, PORT

# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)

# Configure logger
logger = logging.getLogger("license_server")
logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
logger.propagate = False

# Remove any existing handlers
logger.handlers.clear()

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

# File handler - rotate daily, keep configured days
file_handler = TimedRotatingFileHandler(
    os.path.join(LOG_DIR, "license_server.log"),
    when="midnight",
    interval=1,
    backupCount=LOG_RETENTION_DAYS,
    encoding="utf-8"
)
file_handler.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

# Add handlers
logger.addHandler(console_handler)
logger.addHandler(file_handler)

# Cleanup old logs (keep only configured days)
def cleanup_old_logs():
    log_files = [f for f in os.listdir(LOG_DIR) if f.startswith("license_server.log.")]
    for f in log_files:
        filepath = os.path.join(LOG_DIR, f)
        try:
            mtime = os.path.getmtime(filepath)
            age_days = (time.time() - mtime) / 86400
            if age_days > LOG_RETENTION_DAYS:
                os.remove(filepath)
                logger.info(f"Cleaned up old log: {f}")
        except Exception as e:
            logger.error(f"Error cleaning log {f}: {e}")

# Run cleanup on startup
cleanup_old_logs()

app = FastAPI(title="License Server", version="1.0.0")

# Logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Generate unique request ID for correlation
    request_id = str(uuid.uuid4())[:8]
    body_bytes = None
    if request.method in ["POST", "PUT", "PATCH"]:
        body_bytes = await request.body()

    log_msg = f"[{request_id}] {request.method} {request.url.path}"
    if request.query_params:
        log_msg += f" | Query: {dict(request.query_params)}"
    if body_bytes:
        try:
            body = body_bytes.decode()
            log_msg += f" | Body: {body[:500]}"
        except:
            log_msg += " | Body: (binary)"

    logger.info(log_msg)

    response = await call_next(request)

    logger.info(f"[{request_id}] Response: {request.method} {request.url.path} | Status: {response.status_code}")
    return response

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(license_router, prefix="/api/license", tags=["license"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])


@app.on_event("startup")
async def startup_event():
    await init_db()


@app.get("/")
async def root():
    return {"message": "License Server is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="warning",
        access_log=False
    )