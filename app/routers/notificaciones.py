from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.notificaciones import verificar_y_notificar
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/notificaciones", tags=["notificaciones"])


@router.post("/verificar")
async def verificar_manualmente(db: Session = Depends(get_db), _=Depends(get_current_user)):
    enviadas = await verificar_y_notificar(db)
    return {"notificaciones_enviadas": enviadas, "mensaje": f"{enviadas} notificación(es) enviada(s)"}
