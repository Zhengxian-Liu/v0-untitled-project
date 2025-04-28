import motor.motor_asyncio
import logging
import asyncio
from app.core.config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    client: motor.motor_asyncio.AsyncIOMotorClient | None = None
    db: motor.motor_asyncio.AsyncIOMotorDatabase | None = None


mongo_db = MongoDB()

MAX_RETRIES = 5
RETRY_DELAY_SECONDS = 3

async def connect_to_mongo():
    logger.info("Attempting to connect to MongoDB...")
    for attempt in range(MAX_RETRIES):
        try:
            mongo_db.client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.mongo_url,
                serverSelectionTimeoutMS=5000
            )
            # Extract database name from MONGO_URL or set a default
            db_name = settings.mongo_url.split("/")[-1].split("?")[0]
            if not db_name:
                db_name = "promptcraft_db" # Default DB name if not in URL
            mongo_db.db = mongo_db.client[db_name]
            # Try to run a command to check connection
            await mongo_db.client.admin.command('ping')
            logger.info(f"Successfully connected to MongoDB database: {db_name} on attempt {attempt + 1}")
            return

        except Exception as e:
            logger.warning(f"MongoDB connection attempt {attempt + 1}/{MAX_RETRIES} failed: {e}")
            if mongo_db.client:
                mongo_db.client.close()
            mongo_db.client = None
            mongo_db.db = None
            if attempt < MAX_RETRIES - 1:
                 logger.info(f"Retrying in {RETRY_DELAY_SECONDS} seconds...")
                 await asyncio.sleep(RETRY_DELAY_SECONDS)
            else:
                 logger.error("Max MongoDB connection retries reached. Connection failed.")


async def close_mongo_connection():
    logger.info("Closing MongoDB connection...")
    if mongo_db.client:
        mongo_db.client.close()
        logger.info("MongoDB connection closed.")


async def get_database() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    if mongo_db.db is None:
        # This case might happen if the initial connection failed.
        # You could attempt to reconnect or raise an error.
        logger.error("Database not available. Connection might have failed at startup.")
        raise RuntimeError("Database connection is not available.")
    return mongo_db.db 