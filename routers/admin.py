from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import database as db
import jwt
from datetime import datetime, timedelta

router = APIRouter()

# JWT secret - in production, use environment variable
JWT_SECRET = "license-server-secret-key-2024"
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def create_token(username: str) -> str:
    """Create JWT token"""
    payload = {
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@router.post("/login")
async def login(req: LoginRequest):
    """Admin login"""
    user = await db.verify_admin(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(user["username"])
    return {"success": True, "token": token}


@router.post("/change_password")
async def change_password(req: ChangePasswordRequest, authorization: str = Header(None)):
    """Change admin password"""
    # Simple token validation (in production, use proper JWT validation)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未授权")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("username")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="令牌无效")

    result = await db.change_admin_password(username, req.current_password, req.new_password)
    if result.get("success"):
        return {"success": True}
    raise HTTPException(status_code=400, detail=result.get("error", "修改失败"))