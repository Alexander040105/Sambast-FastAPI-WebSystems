import sqlite3

DB_PATH = "database.db"

queries = [
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='users';",
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='pets';",
]

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

for q in queries:
    print(f"\nQuery: {q}")
    row = cur.execute(q).fetchone()
    print(row[0] if row and row[0] else "<not found>")

conn.close()
