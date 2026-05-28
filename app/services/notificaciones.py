from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models import Cuenta
from app.services.whatsapp import notificar_vencimiento


async def verificar_y_notificar(db: Session) -> int:
    hoy = date.today()
    enviadas = 0

    for dias in [1, 8, 30]:
        fecha_objetivo = hoy + timedelta(days=dias)
        campo = f"notificado_{dias}"

        cuentas = db.query(Cuenta).filter(
            Cuenta.fecha_vencimiento == fecha_objetivo,
            getattr(Cuenta, campo) == False  # noqa: E712
        ).all()

        for cuenta in cuentas:
            await notificar_vencimiento(cuenta, dias)
            setattr(cuenta, campo, True)
            db.add(cuenta)
            enviadas += 1

    if enviadas:
        db.commit()

    return enviadas
