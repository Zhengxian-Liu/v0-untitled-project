import logging
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List # If needed for future list endpoint
from datetime import datetime

from app.db.client import get_database
from app.models.common import PyObjectId
from app.models.evaluation_session import (
    EvaluationSession, EvaluationSessionCreate, EvaluationSessionInDB,
    EvaluationSessionSummary # Import the Summary model
)

router = APIRouter()
SESSION_COLLECTION = "evaluation_sessions"

logger = logging.getLogger(__name__)

@router.post(
    "/",
    response_model=EvaluationSession,
    status_code=status.HTTP_201_CREATED,
    summary="Save an evaluation session",
    description="Saves the configuration and results of an evaluation run.",
)
async def save_evaluation_session(
    session_data_in: EvaluationSessionCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Save a completed evaluation session with its results and config."""

    session_doc = {
        "config": session_data_in.config.model_dump(),
        "results": [res.model_dump() for res in session_data_in.results],
        "session_name": session_data_in.session_name or "Saved Evaluation Session",
        "session_description": session_data_in.session_description,
        "saved_at": datetime.utcnow(),
        # Add user ID later if implementing authentication
    }

    # Optionally link back to the original evaluation run ID if provided
    # if session_data_in.evaluationRunId:
    #     session_doc["evaluationRunId"] = session_data_in.evaluationRunId

    try:
        insert_result = await db[SESSION_COLLECTION].insert_one(session_doc)
        created_id = insert_result.inserted_id

        # Fetch the created document to return it
        created_session_doc = await db[SESSION_COLLECTION].find_one({"_id": created_id})
        if created_session_doc:
            # Validate using the DB model before returning (handles _id -> id)
            return EvaluationSession.model_validate(created_session_doc)
        else:
            # Should not happen
            raise HTTPException(status_code=500, detail="Failed to retrieve saved session after creation.")

    except Exception as e:
        logger.error(f"Failed to save evaluation session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save evaluation session: {e}")

# --- NEW: List Endpoint --- M
@router.get(
    "/",
    response_model=List[EvaluationSessionSummary],
    summary="List saved evaluation sessions",
    description="Retrieves a list of previously saved evaluation sessions (summary view).",
)
async def list_saved_sessions(
    db: AsyncIOMotorDatabase = Depends(get_database),
    skip: int = 0,
    limit: int = 100 # Add pagination
):
    """Fetch saved evaluation sessions with pagination, returning summary data."""
    sessions_cursor = db[SESSION_COLLECTION].find(
        {},
        # Projection to fetch only fields needed for Summary model + _id
        {
            "session_name": 1,
            "session_description": 1,
            "saved_at": 1,
            # "config.project": 1, # Example if adding nested fields
            # "config.language": 1
        }
    ).sort("saved_at", -1).skip(skip).limit(limit)

    sessions_raw = await sessions_cursor.to_list(length=limit)

    # Validate using the Summary model
    validated_sessions = []
    for doc in sessions_raw:
        try:
            validated_sessions.append(EvaluationSessionSummary.model_validate(doc))
        except Exception as e:
             logger.error(f"Failed to validate saved session summary with _id {doc.get('_id')}: {e}")

    return validated_sessions
# --- End List Endpoint ---

# --- NEW: Get Single Session Endpoint --- M
@router.get(
    "/{session_id}",
    response_model=EvaluationSession, # Use the full model
    summary="Get details of a saved evaluation session",
    description="Retrieves the complete data for a specific saved evaluation session.",
    responses={404: {"description": "Saved session not found"}}
)
async def get_saved_session(
    session_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Fetch a single saved evaluation session by its ID."""
    session_doc = await db[SESSION_COLLECTION].find_one({"_id": session_id})
    if session_doc:
        # Validate using the full model
        return EvaluationSession.model_validate(session_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved evaluation session with ID {session_id} not found",
        )
# --- End NEW Endpoint ---

# TODO: Add DELETE endpoint later
# DELETE /{session_id} 