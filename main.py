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
from app.db.client import connect_to_mongo, close_mongo_connection
from app.routes import prompts, evaluations # Import the evaluations router
from app.routes import evaluation_sessions # Import the new router

# Configure logging
logging.basicConfig(level=settings.logging_level,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    logger.info("Application startup...")
    await connect_to_mongo()
    yield
    # Code to run on shutdown
    logger.info("Application shutdown...")
    await close_mongo_connection()


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
app.include_router(prompts.router, prefix="/api/v1/prompts", tags=["Prompts"])
app.include_router(evaluations.router, prefix="/api/v1/evaluations", tags=["Evaluations"])
# --- Add Session Router ---
app.include_router(evaluation_sessions.router, prefix="/api/v1/evaluation-sessions", tags=["Evaluation Sessions"])
# --- End Add ---

# Placeholder for future evaluation router
# from app.routes import evaluations
# app.include_router(evaluations.router, prefix="/api/v1/evaluations", tags=["Evaluations"])

if __name__ == "__main__":
    import uvicorn
    # This part is mainly for debugging purposes.
    # Production runs should use a proper ASGI server like Uvicorn directly.
    uvicorn.run(app, host="127.0.0.1", port=8000) 