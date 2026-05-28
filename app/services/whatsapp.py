import httpx
import os
from dotenv import load_dotenv

load_dotenv()

INSTANCE_ID = os.getenv("GREEN_API_INSTANCE_ID")
API_TOKEN = os.getenv("GREEN_API_TOKEN")
WHATSAPP_PHONE = os.getenv("WHATSAPP_PHONE")


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

    tipo_str = "cobrar" if cuenta.tipo == "cxc" else "pagar"
    perfil_str = "Personal" if cuenta.perfil == "personal" else "Ok Web S.A.S."

    if dias == 1:
        emoji = "🔴"
        urgencia = "¡MAÑANA vence!"
    elif dias == 8:
        emoji = "🟠"
        urgencia = f"Vence en {dias} días"
    else:
        emoji = "🟡"
        urgencia = f"Vence en {dias} días"

    valor_fmt = f"$ {cuenta.valor:,.0f}" if cuenta.moneda == "COP" else f"USD {cuenta.valor:,.2f}"

    message = (
        f"{emoji} *Control Finanzas — Alerta*\n\n"
        f"📋 Perfil: {perfil_str}\n"
        f"📌 Concepto: {cuenta.concepto}\n"
        f"💰 Valor: {cuenta.moneda} {valor_fmt}\n"
        f"📅 Vencimiento: {cuenta.fecha_vencimiento.strftime('%d/%m/%Y')}\n"
        f"⚠️ {urgencia} — Cuenta por {tipo_str}"
    )

    await send_whatsapp(phone, message)
