from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Categoria
from app.schemas import CategoriaCreate, CategoriaResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


@router.get("", response_model=List[CategoriaResponse])
async def listar(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Categoria).order_by(Categoria.nombre).all()


@router.post("", response_model=CategoriaResponse)
async def crear(cat: CategoriaCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    existente = db.query(Categoria).filter(Categoria.nombre.ilike(cat.nombre)).first()
    if existente:
        raise HTTPException(status_code=400, detail="La categoría ya existe")
    nueva = Categoria(
        nombre=cat.nombre.strip().capitalize(),
        es_predefinida=False,
        perfil=cat.perfil or 'ambos',
        tipo=cat.tipo or 'ambas',
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/{id}", response_model=CategoriaResponse)
async def actualizar(
    id: int, cat: CategoriaCreate,
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    db_c = db.query(Categoria).filter(Categoria.id == id).first()
    if not db_c:
        raise HTTPException(status_code=404, detail="No encontrada")
    existente = db.query(Categoria).filter(Categoria.nombre.ilike(cat.nombre), Categoria.id != id).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    db_c.nombre = cat.nombre.strip().capitalize()
    db_c.perfil = cat.perfil or 'ambos'
    db_c.tipo = cat.tipo or 'ambas'
    db.commit()
    db.refresh(db_c)
    return db_c


@router.delete("/{id}")
async def eliminar(id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cat = db.query(Categoria).filter(Categoria.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="No encontrada")
    db.delete(cat)
    db.commit()
    return {"ok": True}
