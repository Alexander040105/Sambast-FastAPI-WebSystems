"""
FastAPI dependency functions — DB session, current-principal extraction,
role-based guards.

Principals: staff roles (admin|dispatcher|ops_manager|driver) resolve to a
`users` row; `customer` resolves to a `customers` row. The JWT `role`
claim decides which table to hit — `sub` is the row id in that table.
"""

from typing import Annotated, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.customer import Customer
from app.models.user import User

bearer_scheme = HTTPBearer()

Principal = Union[User, Customer]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Session = Depends(get_db),
) -> Principal:
    """Extract and validate the JWT, then load the principal — Customer for
    role=customer tokens, User for staff roles."""
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        principal_id = int(payload["sub"])
        role = payload.get("role")
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if role == "customer":
        principal = (
            db.query(Customer)
            .filter(Customer.id == principal_id, Customer.is_active.is_(True))
            .first()
        )
    else:
        principal = (
            db.query(User)
            .filter(User.id == principal_id, User.is_active.is_(True))
            .first()
        )
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return principal


def require_role(*allowed_roles: str):
    """Return a dependency that enforces one of the given roles."""

    def _guard(current_user: Principal = Depends(get_current_user)) -> Principal:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted",
            )
        return current_user

    return _guard
