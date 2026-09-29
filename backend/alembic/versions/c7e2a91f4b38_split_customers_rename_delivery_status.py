"""split customers out of users; rename delivery_status_events -> delivery_statuses

Aligns the schema with the instructor's 11 required entities:
Customer, Order, OrderItem, Driver, Vehicle, Delivery, DeliveryStop,
Route, Location, Payment, DeliveryStatus.

- customers: new table holding customer profile + PIN/OTP auth columns.
  Existing users with role='customer' are copied over PRESERVING ids, so
  orders.customer_id / customer_addresses.customer_id values stay valid
  and already-issued customer JWTs keep working.
- users: becomes staff-only (admin|dispatcher|ops_manager|driver);
  PIN/OTP columns are dropped.
- orders.customer_id / customer_addresses.customer_id: FK repointed to
  customers.id.
- notifications: gains customer_id (nullable FK -> customers); user_id is
  relaxed to nullable so customer notifications don't need a users row.
- delivery_status_events -> delivery_statuses (name only, data intact).

Revision ID: c7e2a91f4b38
Revises: 61277863ae10
Create Date: 2026-09-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2a91f4b38'
down_revision: Union[str, Sequence[str], None] = '61277863ae10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

USERS_OTP_COLUMNS = (
    'pin_hash', 'otp_code_hash', 'otp_expires_at', 'otp_attempts',
    'otp_last_sent_at', 'otp_resend_count', 'otp_verified',
)


def upgrade() -> None:
    # 1. customers table — customer profile + OTP/PIN auth state
    op.create_table(
        'customers',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('pin_hash', sa.Text(), nullable=True),
        sa.Column('otp_code_hash', sa.Text(), nullable=True),
        sa.Column('otp_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('otp_attempts', sa.BigInteger(), nullable=True),
        sa.Column('otp_last_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('otp_resend_count', sa.BigInteger(), nullable=True),
        sa.Column('otp_verified', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('phone'),
    )
    op.create_index('ix_customers_email', 'customers', ['email'], unique=False)
    op.create_index('ix_customers_phone', 'customers', ['phone'], unique=False)

    # 2. copy customer users over, preserving ids.
    #    Also copy any user id referenced by a customer FK — dev data may
    #    contain orders pointing at non-'customer' users (e.g. seed bugs).
    op.execute("""
        INSERT INTO customers (id, email, phone, name, pin_hash, otp_code_hash,
            otp_expires_at, otp_attempts, otp_last_sent_at, otp_resend_count,
            otp_verified, is_active, created_at)
        SELECT id, email, phone, name, pin_hash, otp_code_hash, otp_expires_at,
               otp_attempts, otp_last_sent_at, otp_resend_count, otp_verified,
               is_active, created_at
        FROM users
        WHERE role = 'customer'
           OR id IN (SELECT customer_id FROM orders)
           OR id IN (SELECT customer_id FROM customer_addresses)
    """)
    op.execute("""
        SELECT setval(pg_get_serial_sequence('customers', 'id'),
                      COALESCE((SELECT MAX(id) FROM customers), 1))
    """)

    # 3. repoint FKs users -> customers
    op.drop_constraint('orders_customer_id_fkey', 'orders', type_='foreignkey')
    op.create_foreign_key(
        'orders_customer_id_fkey', 'orders', 'customers',
        ['customer_id'], ['id'], ondelete='CASCADE',
    )
    op.drop_constraint(
        'customer_addresses_customer_id_fkey', 'customer_addresses',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'customer_addresses_customer_id_fkey', 'customer_addresses', 'customers',
        ['customer_id'], ['id'], ondelete='CASCADE',
    )

    # 4. notifications can target customers; user_id becomes nullable
    op.add_column(
        'notifications',
        sa.Column('customer_id', sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        'notifications_customer_id_fkey', 'notifications', 'customers',
        ['customer_id'], ['id'], ondelete='CASCADE',
    )
    op.create_index(
        'ix_notifications_customer_id', 'notifications',
        ['customer_id'], unique=False,
    )
    op.alter_column('notifications', 'user_id', nullable=True)
    op.execute("""
        UPDATE notifications SET customer_id = user_id
        WHERE user_id IN (SELECT id FROM customers)
    """)
    # unlink notifications from customer-users rows before deleting them —
    # notifications.user_id is ON DELETE CASCADE and would take the rows
    op.execute("""
        UPDATE notifications SET user_id = NULL
        WHERE user_id IN (SELECT id FROM users WHERE role = 'customer')
    """)

    # 5. users is now staff-only — remove copied rows and moved columns
    op.execute("DELETE FROM users WHERE role = 'customer'")
    for col in USERS_OTP_COLUMNS:
        op.drop_column('users', col)

    # 6. rename the status log to the instructor's DeliveryStatus entity name
    op.rename_table('delivery_status_events', 'delivery_statuses')
    op.execute(
        'ALTER INDEX ix_delivery_status_events_delivery_id '
        'RENAME TO ix_delivery_statuses_delivery_id'
    )


def downgrade() -> None:
    # best-effort reversal — restores the pre-split shape
    op.rename_table('delivery_statuses', 'delivery_status_events')
    op.execute(
        'ALTER INDEX ix_delivery_statuses_delivery_id '
        'RENAME TO ix_delivery_status_events_delivery_id'
    )

    # re-add customer auth columns on users
    op.add_column('users', sa.Column('pin_hash', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('otp_code_hash', sa.Text(), nullable=True))
    op.add_column('users', sa.Column(
        'otp_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('otp_attempts', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column(
        'otp_last_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('otp_resend_count', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column('otp_verified', sa.Boolean(), nullable=True))

    # move customers back into users (same ids) — skip ids that are still
    # present in users (dirty-data copies made during upgrade live in both)
    op.execute("""
        INSERT INTO users (id, role, email, phone, name, password_hash,
            pin_hash, otp_code_hash, otp_expires_at, otp_attempts,
            otp_last_sent_at, otp_resend_count, otp_verified, is_active,
            created_at)
        SELECT c.id, 'customer', c.email, c.phone, c.name, NULL, c.pin_hash,
               c.otp_code_hash, c.otp_expires_at, c.otp_attempts,
               c.otp_last_sent_at, c.otp_resend_count, c.otp_verified,
               c.is_active, c.created_at
        FROM customers c
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.id)
    """)
    op.execute("""
        SELECT setval(pg_get_serial_sequence('users', 'id'),
                      (SELECT MAX(id) FROM users))
    """)

    op.drop_constraint('orders_customer_id_fkey', 'orders', type_='foreignkey')
    op.create_foreign_key(
        'orders_customer_id_fkey', 'orders', 'users',
        ['customer_id'], ['id'], ondelete='CASCADE',
    )
    op.drop_constraint(
        'customer_addresses_customer_id_fkey', 'customer_addresses',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'customer_addresses_customer_id_fkey', 'customer_addresses', 'users',
        ['customer_id'], ['id'], ondelete='CASCADE',
    )

    op.execute("""
        UPDATE notifications SET user_id = customer_id
        WHERE customer_id IS NOT NULL AND user_id IS NULL
    """)
    op.drop_constraint(
        'notifications_customer_id_fkey', 'notifications', type_='foreignkey')
    op.drop_index('ix_notifications_customer_id', table_name='notifications')
    op.drop_column('notifications', 'customer_id')
    op.alter_column('notifications', 'user_id', nullable=False)

    op.drop_index('ix_customers_phone', table_name='customers')
    op.drop_index('ix_customers_email', table_name='customers')
    op.drop_table('customers')
