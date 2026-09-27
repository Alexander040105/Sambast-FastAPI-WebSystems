import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text

def check_users():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    engine = create_engine(url)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT table_schema, column_name FROM information_schema.columns WHERE table_name = 'users';")).fetchall()
        print("Users tables schemas and columns:")
        for r in res:
            print(f"  {r[0]}.{r[1]}")

if __name__ == "__main__":
    check_users()
