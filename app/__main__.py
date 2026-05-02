"""
Standalone app.py file for running the application
"""
import uvicorn
from app import app
from dotenv import load_dotenv
load_dotenv() 


print("Starting the application...")
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)