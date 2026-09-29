"""add customers.password_hash for email + password auth

Customer sign-in moves to email + password (same credential model as
staff). The PIN/OTP columns stay — the legacy contact_no + PIN login
path and /auth/otp/* endpoints remain available but are no longer used
by the UI.

Revision ID: d4f8b21c9e05
Revises: c7e2a91f4b38
Create Date: 2026-09-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f8b21c9e05'
down_revision: Union[str, Sequence[str], None] = 'c7e2a91f4b38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'customers',
        sa.Column('password_hash', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('customers', 'password_hash')
