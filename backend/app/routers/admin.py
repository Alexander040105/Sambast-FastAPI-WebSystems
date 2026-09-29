"""
/api/v1/admin — staff user management.
Admin only. (Admins can also do everything a dispatcher can; dispatchers
cannot reach these endpoints.)
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.core.errors import api_error
from app.core.security import hash_password
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.auth import StaffUserCreate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_staff_user(
    body: StaffUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    existing = (
        db.query(User)
        .filter(func.lower(User.email) == body.email.strip().lower())
        .first()
    )
    if existing:
        raise api_error(
            409, "CONFLICT", "An account with that email already exists."
        )

    user = User(
        role=body.role,
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    db.add(
        AuditLog(
            user_id=admin.id,
            action=f"Admin created {body.role} account for {body.email}",
            category="User Activity",
        )
    )
    db.commit()
    db.refresh(user)
    return user
