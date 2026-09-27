import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text

def sync_schema():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    engine = create_engine(url)
    with engine.begin() as conn:
        print("1. Checking users table columns...")
        user_cols = [c[0] for c in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';")).fetchall()]
        
        missing_cols = {
            "pin_hash": "TEXT",
            "otp_code_hash": "TEXT",
            "otp_expires_at": "TIMESTAMPTZ",
            "otp_attempts": "BIGINT DEFAULT 0",
            "otp_last_sent_at": "TIMESTAMPTZ",
            "otp_resend_count": "BIGINT DEFAULT 0",
            "otp_verified": "BOOLEAN DEFAULT FALSE",
        }
        
        for col_name, col_def in missing_cols.items():
            if col_name not in user_cols:
                print(f"  Adding users.{col_name}...")
                conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def};"))
            else:
                print(f"  users.{col_name} already exists.")

        print("\n2. Checking delivery_status_events table...")
        tables = [t[0] for t in conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")).fetchall()]
        
        if "delivery_status_events" not in tables:
            if "delivery_statuses" in tables:
                print("  Renaming delivery_statuses -> delivery_status_events...")
                conn.execute(text("ALTER TABLE delivery_statuses RENAME TO delivery_status_events;"))
            else:
                print("  Creating delivery_status_events table...")
                conn.execute(text("""
                    CREATE TABLE delivery_status_events (
                        id BIGSERIAL PRIMARY KEY,
                        delivery_id BIGINT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
                        status VARCHAR(20) NOT NULL,
                        note TEXT,
                        lat NUMERIC(10, 7),
                        lng NUMERIC(10, 7),
                        actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
                    );
                    CREATE INDEX idx_delivery_status_events_delivery_id ON delivery_status_events(delivery_id);
                """))
        else:
            print("  delivery_status_events table exists.")

        print("\n3. Checking alembic_version...")
        if "alembic_version" in tables:
            curr_rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
            print(f"  Current alembic_version in DB: {curr_rev}")
            if curr_rev != "61277863ae10":
                print("  Updating alembic_version to 61277863ae10...")
                conn.execute(text("UPDATE alembic_version SET version_num = '61277863ae10';"))
        else:
            print("  Creating alembic_version table...")
            conn.execute(text("""
                CREATE TABLE alembic_version (
                    version_num VARCHAR(32) NOT NULL PRIMARY KEY
                );
                INSERT INTO alembic_version (version_num) VALUES ('61277863ae10');
            """))

    print("\nSchema sync complete!")

if __name__ == "__main__":
    sync_schema()
