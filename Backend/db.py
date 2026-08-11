import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Detect if we are running as a compiled .exe
if getattr(sys, 'frozen', False):
    # Production: Save DB in standard Windows AppData so the uninstaller can wipe it
    app_data = os.getenv('APPDATA')
    
    # The folder name MUST match the "name" field in your package.json
    base_dir = os.path.join(app_data, 'nextgen-invoice')
    
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    db_path = os.path.join(base_dir, 'app.db')
else:
    # Development: Save in the current folder
    db_path = os.path.join(os.path.dirname(__file__), 'app.db')

DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Safety net: ensure all tables exist even if Alembic migrations don't cover them.
# This is idempotent (create_all skips tables that already exist).
def ensure_tables_created():
    """Creates any missing DB tables. Safe to call on every startup."""
    # Import models here to avoid circular imports at module load time
    import importlib
    try:
        import models  # noqa: F401 – side-effect: registers models with Base
        Base.metadata.create_all(bind=engine)
        print("[DB] All tables verified/created successfully.")
    except Exception as e:
        print(f"[DB] Warning: could not create tables: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()