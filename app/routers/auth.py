from fastapi import APIRouter, HTTPException
from app.schemas import LoginRequest, TokenResponse
from datetime import datetime, timedelta
from pathlib import Path
import os
import pyotp
from jose import jwt
from dotenv import dotenv_values

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALGORITHM = "HS256"
_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


def _env():
    """Lee .env directamente por ruta absoluta. Sin depender de os.environ."""
    return dotenv_values(_ENV_PATH)


def _secret_key() -> str:
    v = _env().get("SECRET_KEY") or os.getenv("SECRET_KEY", "dev-secret-change-in-production")
    return v.strip()


def _app_password() -> str:
    v = _env().get("APP_PASSWORD") or os.getenv("APP_PASSWORD", "control2024")
    return v.strip()


def _totp_secret() -> str:
    v = _env().get("TOTP_SECRET") or os.getenv("TOTP_SECRET", "")
    return v.strip()


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
    # 1. Verificar contraseña
    if request.password.strip() != _app_password():
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    # 2. Verificar 2FA si está configurado
    secret = _totp_secret()
    if secret:
        if not request.totp_token or not request.totp_token.strip():
            raise HTTPException(status_code=401, detail="Código 2FA requerido")
        totp = pyotp.TOTP(secret)
        if not totp.verify(request.totp_token.strip(), valid_window=1):
            raise HTTPException(status_code=401, detail="Código 2FA incorrecto")

    return TokenResponse(token=create_token())
