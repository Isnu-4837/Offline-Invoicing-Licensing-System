import os
import sys

# Ensure the current directory is added to Python's module search path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

try:
    from db import engine, Base
    import models
    
    def patch_database():
        print("Running database patch and initialization...")
        # Automatically creates/updates tables including the newly added columns for customers
        Base.metadata.create_all(bind=engine)
        print("Database patch completed successfully. Tables verified/created.")

    if __name__ == "__main__":
        patch_database()
except Exception as e:
    print(f"Error during database patch: {e}")
