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
from app.routes.auth import get_current_active_user
from app.models.user import User as UserModel

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
    current_user: UserModel = Depends(get_current_active_user)
):
    """Save a completed evaluation session with its results and config."""

    session_doc = {
        "config": session_data_in.config.model_dump(),
        "results": [res.model_dump() for res in session_data_in.results],
        "session_name": session_data_in.session_name or "Saved Evaluation Session",
        "session_description": session_data_in.session_description,
        "saved_at": datetime.utcnow(),
        "user_id": current_user.id
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
    limit: int = 100,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Fetch saved evaluation sessions with pagination, returning summary data."""
    sessions_cursor = db[SESSION_COLLECTION].find(
        {"user_id": current_user.id},
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
    current_user: UserModel = Depends(get_current_active_user)
):
    """Fetch a single saved evaluation session by its ID."""
    session_doc = await db[SESSION_COLLECTION].find_one({"_id": session_id})

    if not session_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved evaluation session with ID {session_id} not found",
        )

    # --- ADDED Authorization Check --- M
    if session_doc.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not authorized to access this saved session",
        )
    # --- End Authorization Check ---

    if session_doc:
        # Validate using the full model
        return EvaluationSession.model_validate(session_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved evaluation session with ID {session_id} not found",
        )
# --- End NEW Endpoint ---

# --- NEW: Delete Endpoint --- M
@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a saved evaluation session",
    description="Permanently deletes a saved evaluation session by its ID.",
    responses={
        404: {"description": "Saved session not found"},
        403: {"description": "User not authorized to delete this session"}
    }
)
async def delete_saved_session(
    session_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Delete a specific saved evaluation session after authorization check."""
    # 1. Find the session to check ownership
    session_to_delete = await db[SESSION_COLLECTION].find_one(
        {"_id": session_id},
        {"user_id": 1} # Only fetch user_id for check
    )

    if not session_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved evaluation session with ID {session_id} not found",
        )

    # 2. Check authorization
    if session_to_delete.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not authorized to delete this saved session",
        )

    # 3. Perform deletion
    delete_result = await db[SESSION_COLLECTION].delete_one({"_id": session_id})

    if delete_result.deleted_count == 0:
        # Should not happen normally due to the find_one check above, but handle defensively
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Saved evaluation session with ID {session_id} found but could not be deleted",
        )

    # Return No Content on success
    return
# --- End Delete Endpoint ---