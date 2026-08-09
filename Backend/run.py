import uvicorn
from main import app  # Import the actual app object

if __name__ == "__main__":
    # Pass the 'app' object directly, NOT the string "main:app"
    uvicorn.run(app, host="127.0.0.1", port=8000)