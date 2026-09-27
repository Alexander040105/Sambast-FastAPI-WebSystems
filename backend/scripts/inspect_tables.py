import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text

def inspect_db():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    engine = create_engine(url)
    with engine.connect() as conn:
        tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")).fetchall()
        print("=== Tables in public schema ===")
        for t in tables:
            print(f"  {t[0]}")
        
        # Check alembic_version
        try:
            ver = conn.execute(text("SELECT version_num FROM alembic_version;")).fetchall()
            print(f"\nAlembic version: {[v[0] for v in ver]}")
        except Exception as e:
            print(f"\nNo alembic_version table: {e}")

        # Check users columns
        cols = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';")).fetchall()
        print(f"\nUsers columns: {[c[0] for c in cols]}")

if __name__ == "__main__":
    inspect_db()
