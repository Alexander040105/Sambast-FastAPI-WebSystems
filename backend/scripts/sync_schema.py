import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text

# Current canonical head after the customers split + delivery_statuses rename
HEAD_REVISION = "c7e2a91f4b38"


def sync_schema():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    engine = create_engine(url)
    with engine.begin() as conn:
        print("1. Checking users table columns...")
        user_cols = [c[0] for c in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';")).fetchall()]

        # Post-split, users is staff-only — PIN/OTP auth columns now live on
        # customers. Report leftovers on users instead of re-adding them.
        legacy_otp_cols = [
            "pin_hash", "otp_code_hash", "otp_expires_at", "otp_attempts",
            "otp_last_sent_at", "otp_resend_count", "otp_verified",
        ]
        leftover = [c for c in legacy_otp_cols if c in user_cols]
        if leftover:
            print(f"  WARNING: users still has pre-split OTP/PIN columns: {leftover}")
            print("  -> run `alembic upgrade head` to drop them properly.")
        else:
            print("  users table is clean (staff-only, no OTP/PIN columns).")

        print("\n2. Checking delivery_statuses table...")
        tables = [t[0] for t in conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")).fetchall()]

        if "delivery_statuses" not in tables:
            if "delivery_status_events" in tables:
                print("  Renaming delivery_status_events -> delivery_statuses...")
                conn.execute(text("ALTER TABLE delivery_status_events RENAME TO delivery_statuses;"))
            else:
                print("  Creating delivery_statuses table...")
                conn.execute(text("""
                    CREATE TABLE delivery_statuses (
                        id BIGSERIAL PRIMARY KEY,
                        delivery_id BIGINT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
                        status VARCHAR(20) NOT NULL,
                        note TEXT,
                        lat NUMERIC(10, 7),
                        lng NUMERIC(10, 7),
                        actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
                    );
                    CREATE INDEX idx_delivery_statuses_delivery_id ON delivery_statuses(delivery_id);
                """))
        else:
            print("  delivery_statuses table exists.")

        print("\n3. Checking customers table...")
        if "customers" in tables:
            print("  customers table exists.")
        else:
            print("  WARNING: customers table missing.")
            print("  -> run `alembic upgrade head` — migration c7e2a91f4b38 creates it")
            print("     and repoints orders.customer_id / customer_addresses.customer_id.")

        print("\n4. Checking alembic_version...")
        if "alembic_version" in tables:
            curr_rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
            print(f"  Current alembic_version in DB: {curr_rev}")
            if curr_rev != HEAD_REVISION:
                print(f"  Updating alembic_version to {HEAD_REVISION}...")
                conn.execute(text(f"UPDATE alembic_version SET version_num = '{HEAD_REVISION}';"))
        else:
            print("  Creating alembic_version table...")
            conn.execute(text(f"""
                CREATE TABLE alembic_version (
                    version_num VARCHAR(32) NOT NULL PRIMARY KEY
                );
                INSERT INTO alembic_version (version_num) VALUES ('{HEAD_REVISION}');
            """))

    print("\nSchema sync complete!")

if __name__ == "__main__":
    sync_schema()
