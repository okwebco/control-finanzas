from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, timedelta
import calendar
from app.database import get_db
from app.models import Cuenta, Transaccion
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


def _siguiente_fecha(fecha: date, recurrencia: str) -> date:
    """Avanza la fecha 1 mes o 1 año sin depender de librerías externas."""
    if recurrencia == 'mensual':
        m = fecha.month + 1
        y = fecha.year + (1 if m > 12 else 0)
        m = m if m <= 12 else 1
        dia = min(fecha.day, calendar.monthrange(y, m)[1])
        return date(y, m, dia)
    else:  # anual
        y = fecha.year + 1
        dia = min(fecha.day, calendar.monthrange(y, fecha.month)[1])
        return date(y, fecha.month, dia)


@router.patch("/{id}/registrar", response_model=CuentaResponse)
async def marcar_registrado(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db_c = db.query(Cuenta).filter(Cuenta.id == id).first()
    if not db_c:
        raise HTTPException(status_code=404, detail="No encontrada")
    db_c.registrado = True
    db.commit()
    db.refresh(db_c)

    # Auto-renovar si es recurrente mensual o anual
    if db_c.recurrencia in ('mensual', 'anual'):
        nueva_fecha = _siguiente_fecha(db_c.fecha_vencimiento, db_c.recurrencia)
        nueva = Cuenta(
            perfil=db_c.perfil,
            tipo=db_c.tipo,
            concepto=db_c.concepto,
            detalle=db_c.detalle,
            telefono=db_c.telefono,
            url=db_c.url,
            recurrencia=db_c.recurrencia,
            valor=db_c.valor,
            moneda=db_c.moneda,
            categoria_id=db_c.categoria_id,
            fecha_vencimiento=nueva_fecha,
            registrado=False,
            notificado_30=False,
            notificado_8=False,
            notificado_1=False,
        )
        db.add(nueva)
        db.commit()

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
    # Desvincular transacciones que referencian esta cuenta antes de eliminar
    db.query(Transaccion).filter(Transaccion.cuenta_origen_id == id).update({"cuenta_origen_id": None})
    db.delete(db_c)
    db.commit()
    return {"ok": True}
