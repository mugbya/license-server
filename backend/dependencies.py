from fastapi import HTTPException, Header
import jwt
from private import JWT_SECRET, JWT_ALGORITHM


async def verify_token(authorization: str = Header(None)) -> str:
    """Verify JWT token and return username"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未授权")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="令牌无效")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="令牌无效")
