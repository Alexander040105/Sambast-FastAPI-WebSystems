import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine
from app.db.session import Base
from app import models

def create_db():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    print(f"Connecting to {url.split('@')[1]}")
    engine = create_engine(url)
    
    print("Creating all tables...")
    Base.metadata.create_all(engine)
    print("All tables created via SQLAlchemy.")

if __name__ == "__main__":
    create_db()
