from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


# --- Auth ---

class LoginRequest(BaseModel):
    password: str

class TokenResponse(BaseModel):
    token: str


# --- Categorias ---

class CategoriaBase(BaseModel):
    nombre: str

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaResponse(CategoriaBase):
    id: int
    es_predefinida: bool

    model_config = {"from_attributes": True}


# --- Cuentas ---

class CuentaBase(BaseModel):
    perfil: str
    tipo: str
    fecha_vencimiento: date
    concepto: str
    detalle: Optional[str] = None
    url: Optional[str] = None
    recurrencia: Optional[str] = None
    valor: float
    moneda: str = "COP"
    categoria_id: Optional[int] = None

class CuentaCreate(CuentaBase):
    pass

class CuentaUpdate(CuentaBase):
    pass

class CuentaResponse(CuentaBase):
    id: int
    notificado_30: bool
    notificado_8: bool
    notificado_1: bool
    registrado: bool = False
    created_at: datetime
    categoria: Optional[CategoriaResponse] = None

    model_config = {"from_attributes": True}


# --- Transacciones ---

class TransaccionBase(BaseModel):
    perfil: str
    categoria_id: Optional[int] = None
    fecha: date
    descripcion: str
    valor: float
    tipo: str  # ingreso | egreso

class TransaccionCreate(TransaccionBase):
    pass

class TransaccionUpdate(TransaccionBase):
    pass

class TransaccionResponse(TransaccionBase):
    id: int
    año: int
    created_at: datetime
    categoria: Optional[CategoriaResponse] = None

    model_config = {"from_attributes": True}
