from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, timedelta
from app.database import get_db
from app.models import Cuenta
from app.schemas import CuentaCreate, CuentaUpdate, CuentaResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/cuentas", tags=["cuentas"])


@router.get("", response_model=List[CuentaResponse])
async def listar(
    perfil: Optional[str] = None,
    tipo: Optional[str] = None,
    concepto: Optional[str] = None,
    moneda: Optional[str] = None,
    recurrencia: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Cuenta)
    if perfil:
        q = q.filter(Cuenta.perfil == perfil)
    if tipo:
        q = q.filter(Cuenta.tipo == tipo)
    if concepto:
        q = q.filter(Cuenta.concepto.ilike(f"%{concepto}%"))
    if moneda:
        q = q.filter(Cuenta.moneda == moneda)
    if recurrencia:
        q = q.filter(Cuenta.recurrencia == recurrencia)
    return q.order_by(Cuenta.fecha_vencimiento).all()


@router.get("/alertas")
async def alertas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    hoy = date.today()
    resultado = []

    # Próximas a vencer
    for dias in [1, 8, 30]:
        fecha = hoy + timedelta(days=dias)
        for c in db.query(Cuenta).filter(Cuenta.fecha_vencimiento == fecha).all():
            resultado.append({
                "id": c.id, "dias": dias, "vencida": False,
                "concepto": c.concepto, "tipo": c.tipo, "perfil": c.perfil,
                "valor": c.valor, "moneda": c.moneda,
                "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
            })

    # Vencidas
    for c in db.query(Cuenta).filter(Cuenta.fecha_vencimiento < hoy).all():
        dias_vencida = (hoy - c.fecha_vencimiento).days
        resultado.append({
            "id": c.id, "dias": -dias_vencida, "vencida": True,
            "concepto": c.concepto, "tipo": c.tipo, "perfil": c.perfil,
            "valor": c.valor, "moneda": c.moneda,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
        })

    return resultado


@router.post("", response_model=CuentaResponse)
async def crear(cuenta: CuentaCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    nueva = Cuenta(**cuenta.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/{id}", response_model=CuentaResponse)
async def actualizar(
    id: int, cuenta: CuentaUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    db_c = db.query(Cuenta).filter(Cuenta.id == id).first()
    if not db_c:
        raise HTTPException(status_code=404, detail="No encontrada")
    for k, v in cuenta.model_dump().items():
        setattr(db_c, k, v)
    # Resetear notificaciones al actualizar fecha
    db_c.notificado_30 = False
    db_c.notificado_8 = False
    db_c.notificado_1 = False
    db.commit()
    db.refresh(db_c)
    return db_c


@router.patch("/{id}/registrar", response_model=CuentaResponse)
async def marcar_registrado(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db_c = db.query(Cuenta).filter(Cuenta.id == id).first()
    if not db_c:
        raise HTTPException(status_code=404, detail="No encontrada")
    db_c.registrado = True
    db.commit()
    db.refresh(db_c)
    return db_c


@router.patch("/{id}/desregistrar", response_model=CuentaResponse)
async def desmarcar_registrado(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db_c = db.query(Cuenta).filter(Cuenta.id == id).first()
    if not db_c:
        raise HTTPException(status_code=404, detail="No encontrada")
    db_c.registrado = False
    db.commit()
    db.refresh(db_c)
    return db_c


@router.delete("/{id}")
async def eliminar(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db_c = db.query(Cuenta).filter(Cuenta.id == id).first()
    if not db_c:
        raise HTTPException(status_code=404, detail="No encontrada")
    db.delete(db_c)
    db.commit()
    return {"ok": True}
