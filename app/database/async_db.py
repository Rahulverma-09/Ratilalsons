"""
Async MongoDB database configuration using Motor
"""
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from dotenv import load_dotenv
from ..config import settings
load_dotenv()

logger = logging.getLogger(__name__)

# MongoDB connection settings
MONGO_URI = settings.DATABASE_URL
DB_NAME = settings.DB_NAME

# Global async client and database
_async_client: Optional[AsyncIOMotorClient] = None
_async_db = None

def get_async_database():
    """Get async MongoDB database connection"""
    global _async_client, _async_db
    
    if _async_client is None:
        try:
            logger.info(f"Creating async MongoDB client for {MONGO_URI}")
            _async_client = AsyncIOMotorClient(MONGO_URI)
            _async_db = _async_client[DB_NAME]
            logger.info("Async MongoDB client created successfully")
        except Exception as e:
            logger.error(f"Failed to create async MongoDB client: {str(e)}")
            raise
    
    return _async_db

# Initialize async database
try:
    async_db = get_async_database()
    logger.info("Async database initialized")
except Exception as e:
    logger.error(f"Error initializing async database: {e}")
    async_db = None

async def close_async_db_connection():
    """Close async database connection"""
    global _async_client
    if _async_client:
        _async_client.close()
        logger.info("Async MongoDB connection closed")
