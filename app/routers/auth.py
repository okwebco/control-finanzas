from fastapi import APIRouter, HTTPException
from app.schemas import LoginRequest, TokenResponse
from datetime import datetime, timedelta
from pathlib import Path
import os
from jose import jwt
from dotenv import dotenv_values

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALGORITHM = "HS256"
_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


def _env():
    """Lee .env directamente por ruta absoluta. Sin depender de os.environ."""
    return dotenv_values(_ENV_PATH)


def _secret_key() -> str:
    return _env().get("SECRET_KEY") or os.getenv("SECRET_KEY", "dev-secret-change-in-production")


def _app_password() -> str:
    return _env().get("APP_PASSWORD") or os.getenv("APP_PASSWORD", "control2024")


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
    expected = _app_password()
    print(f"[AUTH] Contraseña esperada: {expected!r}  |  Recibida: {request.password!r}")
    if request.password != expected:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    return TokenResponse(token=create_token())
