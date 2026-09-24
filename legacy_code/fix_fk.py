import os
import sqlite3
import sys


def table_exists(cursor, table_name):
    row = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "database.db"

    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Required by the migration sequence.
        cursor.execute("PRAGMA foreign_keys = OFF;")

        if not table_exists(cursor, "pets"):
            raise RuntimeError("Table 'pets' does not exist. Nothing to migrate.")

        if table_exists(cursor, "pets_old"):
            raise RuntimeError(
                "Table 'pets_old' already exists. Resolve it before running this script."
            )

        users_columns = {
            row[1] for row in cursor.execute("PRAGMA table_info(users)").fetchall()
        }
        if "user_id" not in users_columns:
            raise RuntimeError("Table 'users' is missing expected 'user_id' column.")

        cursor.execute("BEGIN;")

        cursor.execute("ALTER TABLE pets RENAME TO pets_old;")

        cursor.execute(
            """
            CREATE TABLE pets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT,
                species TEXT,
                breed TEXT,
                age_months INTEGER,
                weight_kg REAL,
                lifestyle_classification TEXT DEFAULT 'Unclassified',
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
            """
        )

        cursor.execute(
            """
            INSERT INTO pets (
                id,
                user_id,
                name,
                species,
                breed,
                age_months,
                weight_kg,
                lifestyle_classification
            )
            SELECT
                id,
                user_id,
                name,
                species,
                breed,
                age_months,
                weight_kg,
                lifestyle_classification
            FROM pets_old
            """
        )

        cursor.execute("DROP TABLE pets_old;")
        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.execute("PRAGMA foreign_keys = ON;")
        conn.commit()

    fk_rows = cursor.execute("PRAGMA foreign_key_list(pets)").fetchall()
    fk_ok = any(
        row[2] == "users" and row[3] == "user_id" and row[4] == "user_id"
        for row in fk_rows
    )

    if not fk_ok:
        raise RuntimeError("FK validation failed: pets.user_id is not mapped to users.user_id")

    print("pets foreign key repair complete.")


if __name__ == "__main__":
    main()
