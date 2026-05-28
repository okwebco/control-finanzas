from fastapi import APIRouter, HTTPException
from app.schemas import LoginRequest, TokenResponse
from datetime import datetime, timedelta
import os
from jose import jwt

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
APP_PASSWORD = os.getenv("APP_PASSWORD", "control2024")
ALGORITHM = "HS256"


def create_token() -> str:
    expire = datetime.utcnow() + timedelta(days=30)
    return jwt.encode({"sub": "admin", "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    if request.password != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    return TokenResponse(token=create_token())
