from db import engine
import models

def fix_schema():
    print("Dropping old SystemConfig table...")
    # This safely deletes ONLY the config table, leaving your invoices and inventory untouched
    models.SystemConfig.__table__.drop(engine, checkfirst=True)
    
    print("Recreating table with new columns...")
    models.SystemConfig.__table__.create(engine, checkfirst=True)
    
    print("Database schema updated successfully!")

if __name__ == "__main__":
    fix_schema()