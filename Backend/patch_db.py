import os
import sys
import sqlite3

# Determine database path based on environment (matches db.py logic)
if getattr(sys, 'frozen', False):
    base_dir = os.path.join(os.path.expanduser('~'), 'NextGenInvoice')
    db_path = os.path.join(base_dir, 'app.db')
else:
    db_path = os.path.join(os.path.dirname(__file__), 'app.db')

def patch_database():
    print(f"Targeting database at: {db_path}")
    
    if not os.path.exists(db_path):
        print("Database not found. It will be created automatically when the main app or FastAPI starts.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Example 1: Safely create new tables if they don't exist yet
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_string VARCHAR UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                activated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS purchase_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vendor_name VARCHAR,
                bill_number VARCHAR,
                bill_date VARCHAR,
                total_amount FLOAT,
                status VARCHAR
            )
        """)

        # Example 2: Safely add missing columns to existing tables (SQLite check-before-add pattern)
        cursor.execute("PRAGMA table_info(invoices);")
        columns = [col[1] for col in cursor.fetchall()]

        # Check and add columns dynamically if they were introduced in newer updates
        new_columns = [
            ("digital_signature", "VARCHAR"),
            ("company_logo", "VARCHAR"),
            ("qr_code_image", "VARCHAR"),
            ("firm_state_code", "VARCHAR")
        ]

        for col_name, col_type in new_columns:
            if col_name not in columns:
                cursor.execute(f"ALTER TABLE invoices ADD COLUMN {col_name} {col_type};")
                print(f"Added missing column '{col_name}' to invoices table.")

        conn.commit()
        print("Database patch completed successfully! All schemas are up to date.")

    except Exception as e:
        conn.rollback()
        print(f"Error patching database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    patch_database()