from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers.license import router as license_router
from routers.admin import router as admin_router
import uvicorn

app = FastAPI(title="License Server", version="1.0.0")

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