import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, inspect
from app.db.session import Base
import app.models  # load all models

def check_schema_drift():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    engine = create_engine(url)
    inspector = inspect(engine)
    
    db_tables = set(inspector.get_table_names())
    print("Database tables:", sorted(list(db_tables)))
    
    for table_name, table in Base.metadata.tables.items():
        if table_name not in db_tables:
            print(f"\n[MISSING TABLE] {table_name}")
            continue
        
        db_cols = {c["name"]: c for c in inspector.get_columns(table_name)}
        model_cols = set(table.columns.keys())
        
        missing_in_db = model_cols - set(db_cols.keys())
        if missing_in_db:
            print(f"\n[TABLE {table_name}] Missing columns in DB: {missing_in_db}")

if __name__ == "__main__":
    check_schema_drift()
