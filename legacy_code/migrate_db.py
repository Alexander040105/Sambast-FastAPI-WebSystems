import sqlite3

def run_migration(db_path='database.db'):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Enforce foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Add columns to products table
    columns_to_add = [
        ("purpose", "TEXT"),
        ("target_species", "TEXT"),
        ("tags", "TEXT")
    ]

    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type};")
            print(f"Added column {col_name} to products.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column {col_name} already exists in products.")
            else:
                print(f"Error adding {col_name}: {e}")

    # Create pets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pets (
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
    ''')
    print("Checked/Created pets table.")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    run_migration()
    print("Migration successful.")
