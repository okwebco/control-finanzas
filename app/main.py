from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

from app.database import engine, SessionLocal, Base
from app.models import Categoria  # noqa: F401 — needed for table creation
from app.routers import auth, cuentas, transacciones, categorias, exportar, notificaciones
from app.services.notificaciones import verificar_y_notificar

CATEGORIAS_PREDEFINIDAS = [
    "Alimentación", "Comunicaciones", "Educación", "Familia",
    "Finanzas", "Gadgets", "Impuestos", "Inversión",
    "Operativo", "Recreación", "Representación", "Salud",
    "Seguros", "Suscripciones", "Transporte", "Vivienda",
]

scheduler = AsyncIOScheduler()


def migrate_db():
    """Migraciones manuales seguras — solo agrega columnas si no existen."""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE cuentas ADD COLUMN categoria_id INTEGER REFERENCES categorias(id)"))
            conn.commit()
            print("[DB] Migración: columna categoria_id agregada a cuentas")
        except Exception:
            pass  # Ya existe — ignorar
        try:
            conn.execute(text("ALTER TABLE cuentas ADD COLUMN registrado BOOLEAN DEFAULT 0"))
            conn.commit()
            print("[DB] Migración: columna registrado agregada a cuentas")
        except Exception:
            pass  # Ya existe — ignorar
        try:
            conn.execute(text("ALTER TABLE categorias ADD COLUMN perfil VARCHAR(20) DEFAULT 'ambos'"))
            conn.commit()
            print("[DB] Migración: columna perfil agregada a categorias")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE categorias ADD COLUMN tipo VARCHAR(10) DEFAULT 'ambas'"))
            conn.commit()
            print("[DB] Migración: columna tipo agregada a categorias")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE transacciones ADD COLUMN cuenta_origen_id INTEGER REFERENCES cuentas(id)"))
            conn.commit()
            print("[DB] Migración: columna cuenta_origen_id agregada a transacciones")
        except Exception:
            pass


def seed_categorias():
    db = SessionLocal()
    try:
        for nombre in CATEGORIAS_PREDEFINIDAS:
            if not db.query(Categoria).filter(Categoria.nombre == nombre).first():
                db.add(Categoria(nombre=nombre, es_predefinida=True))
        db.commit()
    finally:
        db.close()


async def tarea_notificaciones_diaria():
    db = SessionLocal()
    try:
        n = await verificar_y_notificar(db)
        if n:
            print(f"[Scheduler] {n} notificación(es) enviada(s)")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Arranque
    Base.metadata.create_all(bind=engine)
    migrate_db()
    seed_categorias()

    # Verificar notificaciones al iniciar
    db = SessionLocal()
    try:
        await verificar_y_notificar(db)
    finally:
        db.close()

    # Programar verificación diaria a las 8:00 AM
    scheduler.add_job(tarea_notificaciones_diaria, "cron", hour=8, minute=0)
    scheduler.start()

    yield

    scheduler.shutdown()


app = FastAPI(title="Control Finanzas", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(cuentas.router)
app.include_router(transacciones.router)
app.include_router(categorias.router)
app.include_router(exportar.router)
app.include_router(notificaciones.router)

app.mount("/static", StaticFiles(directory="static"), name="static")


_NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}


@app.get("/")
async def root():
    return FileResponse("static/index.html", headers=_NO_CACHE)


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    return FileResponse("static/index.html", headers=_NO_CACHE)
