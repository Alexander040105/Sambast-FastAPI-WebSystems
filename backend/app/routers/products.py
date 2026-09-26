import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.products import Product
from app.models.user import User
from app.schemas.fleet import Pagination
from app.schemas.products import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])

# Columns the client is allowed to sort by — anything else falls back to
# created_at so a bad sort_by can't inject into ORDER BY.
SORTABLE_COLUMNS = {
    "name": Product.name,
    "price": Product.base_price,
    "base_price": Product.base_price,
    "stock": Product.stock_quantity,
    "stock_quantity": Product.stock_quantity,
    "created_at": Product.created_at,
}


@router.get("", response_model=dict)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_archived: bool = Query(False),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = db.query(Product)
    if not include_archived:
        query = query.filter(Product.is_archived.is_(False))

    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(
            or_(Product.name.ilike(needle), Product.description.ilike(needle))
        )

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    sort_column = SORTABLE_COLUMNS.get(sort_by, Product.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / page_size))
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    data = []
    for product in items:
        data.append(ProductOut.model_validate(product).model_dump())

    return {
        "data": data,
        "pagination": Pagination(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        ).model_dump(),
    }


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or product.is_archived:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    # unit_options/discounts are pydantic objects — convert to plain dicts
    # so the JSONB columns can store them
    unit_options = None
    if body.unit_options:
        unit_options = [option.model_dump() for option in body.unit_options]

    discounts = None
    if body.discounts:
        discounts = [discount.model_dump() for discount in body.discounts]

    product = Product(
        category_id=body.category_id,
        name=body.name,
        description=body.description,
        base_price=body.base_price,
        unit=body.unit,
        unit_options=unit_options,
        discounts=discounts,
        weight_kg_per_unit=body.weight_kg_per_unit,
        stock_quantity=body.stock_quantity,
        image_url=body.image_url,
        is_archived=body.is_archived,
        purpose=body.purpose,
        target_species=body.target_species,
        tags=body.tags,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
