from fastapi import APIRouter, HTTPException
from app.schemas import LoginRequest, TokenResponse
from datetime import datetime, timedelta
import os
from jose import jwt
from dotenv import load_dotenv

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALGORITHM = "HS256"


def _secret_key() -> str:
    load_dotenv(override=True)
    return os.getenv("SECRET_KEY", "dev-secret-change-in-production")


def _app_password() -> str:
    load_dotenv(override=True)
    return os.getenv("APP_PASSWORD", "control2024")


def create_token() -> str:
    expire = datetime.utcnow() + timedelta(days=30)
    return jwt.encode({"sub": "admin", "exp": expire}, _secret_key(), algorithm=ALGORITHM)


def verify_token(token: str) -> bool:
    try:
        jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])
        return True
    except Exception:
        return False


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    if request.password != _app_password():
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    return TokenResponse(token=create_token())
