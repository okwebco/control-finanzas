from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models import Transaccion
from app.schemas import TransaccionCreate, TransaccionUpdate, TransaccionResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/transacciones", tags=["transacciones"])


@router.get("", response_model=List[TransaccionResponse])
async def listar(
    perfil: Optional[str] = None,
    año: Optional[int] = None,
    tipo: Optional[str] = None,
    categoria_id: Optional[int] = None,
    descripcion: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Transaccion)
    if perfil:
        q = q.filter(Transaccion.perfil == perfil)
    if año:
        q = q.filter(Transaccion.año == año)
    if tipo:
        q = q.filter(Transaccion.tipo == tipo)
    if categoria_id:
        q = q.filter(Transaccion.categoria_id == categoria_id)
    if descripcion:
        q = q.filter(Transaccion.descripcion.ilike(f"%{descripcion}%"))
    return q.order_by(Transaccion.fecha.desc()).all()


@router.get("/resumen")
async def resumen(
    perfil: Optional[str] = None,
    año: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Transaccion)
    if perfil:
        q = q.filter(Transaccion.perfil == perfil)
    if año:
        q = q.filter(Transaccion.año == año)
    transacciones = q.all()

    total_ingresos = sum(t.valor for t in transacciones if t.tipo == "ingreso")
    total_egresos = sum(t.valor for t in transacciones if t.tipo == "egreso")

    por_categoria = {}
    for t in transacciones:
        nombre = t.categoria.nombre if t.categoria else "Sin categoría"
        if nombre not in por_categoria:
            por_categoria[nombre] = {"ingresos": 0.0, "egresos": 0.0}
        if t.tipo == "ingreso":
            por_categoria[nombre]["ingresos"] += t.valor
        else:
            por_categoria[nombre]["egresos"] += t.valor

    return {
        "total_ingresos": total_ingresos,
        "total_egresos": total_egresos,
        "saldo": total_ingresos - total_egresos,
        "por_categoria": por_categoria,
    }


@router.post("", response_model=TransaccionResponse)
async def crear(t: TransaccionCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    datos = t.model_dump()
    datos["año"] = t.fecha.year
    nueva = Transaccion(**datos)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/{id}", response_model=TransaccionResponse)
async def actualizar(
    id: int, t: TransaccionUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    db_t = db.query(Transaccion).filter(Transaccion.id == id).first()
    if not db_t:
        raise HTTPException(status_code=404, detail="No encontrada")
    datos = t.model_dump()
    datos["año"] = t.fecha.year
    for k, v in datos.items():
        setattr(db_t, k, v)
    db.commit()
    db.refresh(db_t)
    return db_t


@router.delete("/{id}")
async def eliminar(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    db_t = db.query(Transaccion).filter(Transaccion.id == id).first()
    if not db_t:
        raise HTTPException(status_code=404, detail="No encontrada")
    db.delete(db_t)
    db.commit()
    return {"ok": True}


@router.patch("/{id}/retornar")
async def retornar(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Elimina la transacción y desregistra la cuenta de origen si aplica."""
    from app.models import Cuenta
    db_t = db.query(Transaccion).filter(Transaccion.id == id).first()
    if not db_t:
        raise HTTPException(status_code=404, detail="No encontrada")
    cuenta_id = db_t.cuenta_origen_id
    db.delete(db_t)
    if cuenta_id:
        db_c = db.query(Cuenta).filter(Cuenta.id == cuenta_id).first()
        if db_c:
            db_c.registrado = False
    db.commit()
    return {"ok": True, "cuenta_id": cuenta_id}
