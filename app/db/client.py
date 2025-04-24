import motor.motor_asyncio
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    client: motor.motor_asyncio.AsyncIOMotorClient | None = None
    db: motor.motor_asyncio.AsyncIOMotorDatabase | None = None


mongo_db = MongoDB()


async def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    try:
        mongo_db.client = motor.motor_asyncio.AsyncIOMotorClient(settings.mongo_url)
        # Extract database name from MONGO_URL or set a default
        db_name = settings.mongo_url.split("/")[-1].split("?")[0]
        if not db_name:
            db_name = "promptcraft_db" # Default DB name if not in URL
        mongo_db.db = mongo_db.client[db_name]
        # Try to run a command to check connection
        await mongo_db.client.admin.command('ping')
        logger.info(f"Successfully connected to MongoDB database: {db_name}")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        mongo_db.client = None
        mongo_db.db = None
        # Depending on policy, you might want to raise the exception
        # or exit the application if DB connection is critical at startup.
        # raise


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