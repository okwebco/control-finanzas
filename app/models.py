from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    es_predefinida = Column(Boolean, default=False)
    # personal | laboral | ambos — a qué perfil aplica
    perfil = Column(String(20), default='ambos')
    # cxc | cxp | ambas — a qué tipo de cuenta aplica
    tipo = Column(String(10), default='ambas')

    transacciones = relationship("Transaccion", back_populates="categoria")
    cuentas = relationship("Cuenta", back_populates="categoria")


class Cuenta(Base):
    __tablename__ = "cuentas"

    id = Column(Integer, primary_key=True, index=True)
    perfil = Column(String(20), nullable=False)        # personal | laboral
    tipo = Column(String(10), nullable=False)          # cxc | cxp
    fecha_vencimiento = Column(Date, nullable=False)
    concepto = Column(String(200), nullable=False)
    detalle = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)
    recurrencia = Column(String(20), nullable=True)    # mensual | anual | unica
    valor = Column(Float, nullable=False)
    moneda = Column(String(5), default="COP")          # COP | USD
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)

    notificado_30 = Column(Boolean, default=False)
    notificado_8 = Column(Boolean, default=False)
    notificado_1 = Column(Boolean, default=False)
    registrado = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    categoria = relationship("Categoria", back_populates="cuentas")


class Transaccion(Base):
    __tablename__ = "transacciones"

    id = Column(Integer, primary_key=True, index=True)
    perfil = Column(String(20), nullable=False)        # personal | laboral
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    fecha = Column(Date, nullable=False)
    año = Column(Integer, nullable=False)
    descripcion = Column(String(500), nullable=False)
    valor = Column(Float, nullable=False)
    tipo = Column(String(10), nullable=False)           # ingreso | egreso

    created_at = Column(DateTime, default=datetime.utcnow)

    categoria = relationship("Categoria", back_populates="transacciones")
