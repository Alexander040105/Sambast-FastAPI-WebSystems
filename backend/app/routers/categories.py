from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.categories import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=dict)
def list_categories(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    categories = db.query(Category).order_by(Category.name).all()

    data = []
    for category in categories:
        data.append(CategoryOut.model_validate(category).model_dump())

    return {"data": data}


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    existing = db.query(Category).filter(Category.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="A category with that name already exists")

    unit_options = None
    if body.unit_options:
        unit_options = [option.model_dump() for option in body.unit_options]

    category = Category(
        name=body.name.strip(),
        unit_options=unit_options,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = body.model_dump(exclude_unset=True)

    # JSONB column needs plain dicts, not pydantic objects
    if "unit_options" in update_data and update_data["unit_options"] is not None:
        update_data["unit_options"] = [
            option.model_dump() if hasattr(option, "model_dump") else option
            for option in update_data["unit_options"]
        ]

    if "name" in update_data:
        clash = db.query(Category).filter(
            Category.name == update_data["name"],
            Category.id != category_id,
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="A category with that name already exists")

    for key, value in update_data.items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()
