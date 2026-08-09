import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Detect if we are running as a compiled .exe
if getattr(sys, 'frozen', False):
    # Production: Save DB in the user's home directory (e.g., C:\Users\Name\NextGenInvoice)
    base_dir = os.path.join(os.path.expanduser('~'), 'NextGenInvoice')
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()