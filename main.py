from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers.license import router as license_router
from routers.admin import router as admin_router
from routers.projects import router as projects_router
import uvicorn

app = FastAPI(title="License Server", version="1.0.0")

# Logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"\n>>> {request.method} {request.url.path}")
    if request.query_params:
        print(f"    Query: {dict(request.query_params)}")

    response = await call_next(request)

    print(f"<<< Status: {response.status_code}")
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
        host="0.0.0.0",
        port=80,
        reload=True
    )