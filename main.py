import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Import CORS middleware
from bson import ObjectId
from fastapi.encoders import ENCODERS_BY_TYPE
from app.models.common import PyObjectId

# Add custom encoder for BSON ObjectId and our subclass
ENCODERS_BY_TYPE[ObjectId] = str
ENCODERS_BY_TYPE[PyObjectId] = str

from app.core.config import settings
from app.db.client import connect_to_mongo, close_mongo_connection, get_database # Import get_database
from app.routes import prompts, evaluations, evaluation_sessions, test_sets
from app.routes import auth # Import the auth router
from app.routes import prompt_config

# Configure logging - Using settings.logging_level
logging.basicConfig(level=settings.logging_level, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# --- BEGIN Logging Debug & FORCE LEVEL ---
root_logger = logging.getLogger()
main_app_logger = logging.getLogger(__name__) # Logger for main.py itself
app_logger = logging.getLogger("app") # Get the parent 'app' logger

print(f"--- Post basicConfig (in main.py) ---", flush=True)
print(f"settings.log_level (str from config): {settings.log_level}", flush=True)
print(f"settings.logging_level (int from config): {settings.logging_level}", flush=True)
print(f"Root logger level BEFORE forcing: {logging.getLevelName(root_logger.getEffectiveLevel())} ({root_logger.getEffectiveLevel()})", flush=True)
print(f"Logger '{main_app_logger.name}' level BEFORE forcing: {logging.getLevelName(main_app_logger.getEffectiveLevel())} ({main_app_logger.getEffectiveLevel()})", flush=True)
print(f"Logger 'app' level BEFORE forcing: {logging.getLevelName(app_logger.getEffectiveLevel())} ({app_logger.getEffectiveLevel()})", flush=True)

# Force desired level if settings.logging_level is INFO or DEBUG
if settings.logging_level <= logging.INFO:
    print(f"--- Forcing Root and App loggers to level {logging.getLevelName(settings.logging_level)} ---", flush=True)
    root_logger.setLevel(settings.logging_level)
    app_logger.setLevel(settings.logging_level) # Ensure 'app' and its children inherit correctly
    print(f"Root logger level AFTER forcing: {logging.getLevelName(root_logger.getEffectiveLevel())} ({root_logger.getEffectiveLevel()})", flush=True)
    print(f"Logger 'app' level AFTER forcing: {logging.getLevelName(app_logger.getEffectiveLevel())} ({app_logger.getEffectiveLevel()})", flush=True)
# --- END Logging Debug & FORCE LEVEL ---

# Set pymongo logger level higher to reduce verbosity
logging.getLogger("pymongo").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    main_app_logger.info("Application startup...")
    await connect_to_mongo()
    # Get the database instance and attach it to the app state
    # This makes it accessible via request.app.db in route handlers
    app.db = await get_database() 
    yield
    # Code to run on shutdown
    main_app_logger.info("Application shutdown...")
    await close_mongo_connection()
    app.db = None # Clear the reference on shutdown


app = FastAPI(
    title="PromptCraft API",
    description="API for managing AI prompts and evaluations.",
    version="0.1.0",
    lifespan=lifespan
)

# --- CORS Middleware Configuration ---
# List of allowed origins (e.g., your frontend development server)
# In production, replace these with your actual frontend domain(s).
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://c95c-111-246-80-120.ngrok-free.app",
    # Add any other origins if needed
    # "*" # Allows all origins (use with caution, less secure)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # Allows cookies to be included in requests
    allow_methods=["*"],    # Allows all standard HTTP methods
    allow_headers=["*"],    # Allows all headers
)
# --- End CORS Configuration ---

@app.get("/ping", tags=["Health"])
async def ping():
    """Basic health check endpoint."""
    return {"message": "pong"}


# Include the routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"]) # Add Auth router
app.include_router(prompts.router, prefix="/api/v1/prompts", tags=["Prompts"])
app.include_router(evaluations.router, prefix="/api/v1/evaluations", tags=["Evaluations"])
app.include_router(evaluation_sessions.router, prefix="/api/v1/evaluation-sessions", tags=["Evaluation Sessions"])
app.include_router(prompt_config.router, prefix="/api/v1", tags=["Prompt Configuration"])
app.include_router(test_sets.router)

# Placeholder for future evaluation router
# from app.routes import evaluations
# app.include_router(evaluations.router, prefix="/api/v1/evaluations", tags=["Evaluations"])

if __name__ == "__main__":
    import uvicorn
    # This part is mainly for debugging purposes.
    # Production runs should use a proper ASGI server like Uvicorn directly.
    uvicorn.run(app, host="127.0.0.1", port=8000) 