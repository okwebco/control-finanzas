import httpx
import os
from dotenv import load_dotenv

load_dotenv()

INSTANCE_ID    = os.getenv("GREEN_API_INSTANCE_ID", "").strip()
API_TOKEN      = os.getenv("GREEN_API_TOKEN", "").strip()
WHATSAPP_PHONE = os.getenv("WHATSAPP_PHONE", "").strip()

MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _fmt_cop(valor: float) -> str:
    """$1 859 928 COP — miles separados por espacio, sin punto ni coma."""
    partes = []
    s = str(int(round(valor)))
    while len(s) > 3:
        partes.insert(0, s[-3:])
        s = s[:-3]
    partes.insert(0, s)
    return f"${' '.join(partes)} COP"


def _fecha_es(d) -> str:
    """Mayo 30 de 2026"""
    return f"{MESES[d.month - 1]} {d.day} de {d.year}"


async def send_whatsapp(phone: str, message: str) -> dict:
    if not INSTANCE_ID or not API_TOKEN:
        print("[WhatsApp] Green API no configurado — revisa .env")
        return {"error": "Green API no configurado"}

    url = f"https://api.green-api.com/waInstance{INSTANCE_ID}/sendMessage/{API_TOKEN}"
    payload = {"chatId": f"{phone}@c.us", "message": message}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json=payload)
            return r.json()
    except Exception as e:
        print(f"[WhatsApp] Error: {e}")
        return {"error": str(e)}


async def notificar_vencimiento(cuenta, dias: int):
    phone = WHATSAPP_PHONE
    if not phone:
        return

    # Perfil
    perfil_str = "😀 Jhon Vélez" if cuenta.perfil == "personal" else "🏢 Ok Web"

    # Valor
    if cuenta.moneda == "COP":
        valor_fmt = _fmt_cop(cuenta.valor)
    else:
        valor_fmt = f"USD {cuenta.valor:,.2f}"

    # Fecha
    fecha_fmt = _fecha_es(cuenta.fecha_vencimiento)

    # Urgencia: 🔆 para CxC, ✏️ para CxP
    icono  = "🔆" if cuenta.tipo == "cxc" else "✏️"
    tipo   = cuenta.tipo          # 'cxc' o 'cxp'
    unidad = "día" if dias == 1 else "días"
    urgencia = f"{icono} {tipo} en {dias} {unidad}"

    message = (
        f"📊 *Control finanzas*\n\n"
        f"{perfil_str}\n"
        f"📌 {cuenta.concepto}\n"
        f"💰 {valor_fmt}\n"
        f"📅 {fecha_fmt}\n"
        f"{urgencia}\n"
        f"https://finanzas.jhonvelez.com"
    )

    await send_whatsapp(phone, message)
