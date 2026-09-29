import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text

def reset_db():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    print(f"Connecting to {url.split('@')[1]}")
    engine = create_engine(url, isolation_level="AUTOCOMMIT")
    conn = engine.connect()
    
    try:
        print("Terminating other connections...")
        conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"))
    except Exception as e:
        print(f"Error terminating connections: {e}")
        
    print("Dropping schema public cascade...")
    conn.execute(text("DROP SCHEMA public CASCADE;"))
    
    print("Creating schema public...")
    conn.execute(text("CREATE SCHEMA public;"))
    
    print("Dropping alembic_version type...")
    conn.execute(text("DROP TYPE IF EXISTS alembic_version CASCADE;"))
    
    print("Done!")
    conn.close()

if __name__ == "__main__":
    reset_db()
