import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text

def check_customer_ids():
    url = os.getenv("DATABASE_URL_DIRECT")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    engine = create_engine(url)
    with engine.connect() as conn:
        print("Customers rows:")
        customers = conn.execute(text("SELECT * FROM customers;")).fetchall()
        for c in customers:
            print(" ", c)
            
        print("\nOrders customer_ids distinct:")
        order_cust_ids = conn.execute(text("SELECT DISTINCT customer_id FROM orders;")).fetchall()
        for o in order_cust_ids:
            print(" ", o)

        print("\nUsers ids:")
        user_ids = conn.execute(text("SELECT id, role, email FROM users;")).fetchall()
        for u in user_ids:
            print(" ", u)

if __name__ == "__main__":
    check_customer_ids()
