from fastapi import HTTPException, Header
from typing import Optional
from pathlib import Path
import os
from jose import jwt, JWTError
from dotenv import dotenv_values

ALGORITHM = "HS256"
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def _secret_key() -> str:
    vals = dotenv_values(_ENV_PATH)
    return vals.get("SECRET_KEY") or os.getenv("SECRET_KEY", "dev-secret-change-in-production")


def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    token = authorization.replace("Bearer ", "")
    try:
        jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return True
