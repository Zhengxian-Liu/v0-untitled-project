from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from typing import List
import json # For parsing mappings if needed, though service handles it
import uuid
import logging # Added logging

from app.services.test_set_service import process_and_save_test_set, USER_TEST_SETS_COLLECTION, TEST_SET_ENTRIES_COLLECTION
from app.models.test_set_models import UserTestSetInDB, TestSetUploadResponse, UserTestSetSummary, TestSetEntryBase
from app.models.user import User # Assuming you have this from your auth setup
from app.routes.auth import get_current_active_user # Corrected import path
from motor.motor_asyncio import AsyncIOMotorDatabase # Added for type hinting
from app.db.client import get_database # Added for dependency injection

logger = logging.getLogger(__name__) # Added logger instance

router = APIRouter(
    prefix="/api/v1/test-sets",
    tags=["Test Sets"],
)

@router.post("/upload", response_model=TestSetUploadResponse)
async def upload_test_set(
    request: Request, # To access the db client, adjust if your setup is different
    file: UploadFile = File(...),
    test_set_name: str = Form(...),
    language_code: str = Form(...),
    mappings: str = Form(...), # JSON string of ColumnMappingModel
    original_file_name: str = Form(...),
    file_type: str = Form(...),
    current_user: User = Depends(get_current_active_user) # Your actual auth dependency
):
    """
    Uploads a test set file (CSV/Excel), processes it based on column mappings,
    and saves it to the database.
    """
    # db = request.app.db # Keep this or switch to Depends(get_database) as discussed for consistency
    # For now, assuming request.app.db is correctly populated by main.py's lifespan
    db_from_request = request.app.db 
    
    if not current_user or not current_user.id:
        raise HTTPException(status_code=403, detail="User not authenticated or user ID missing.")

    try:
        saved_test_set = await process_and_save_test_set(
            db=db_from_request, # Use db from request context for now
            file=file,
            test_set_name=test_set_name,
            language_code=language_code,
            mappings_json=mappings,
            original_file_name=original_file_name,
            file_type=file_type,
            user_id=str(current_user.id) # Ensure user_id is a string if your model expects it
        )
        return TestSetUploadResponse(
            message="Test set uploaded and processed successfully.",
            test_set_id=saved_test_set.id,
            test_set_name=saved_test_set.test_set_name
        )
    except HTTPException as e:
        raise e # Re-raise HTTPExceptions from the service layer
    except Exception as e:
        # Catch any other unexpected errors
        print(f"Unexpected error during test set upload: {e}") # Log it
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}") 

@router.get("/mine", response_model=List[UserTestSetSummary])
async def list_my_test_sets(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves a list of test set metadata uploaded by the current user.
    Filters by the user's language by default.
    """
    if not current_user or not current_user.id:
        raise HTTPException(status_code=403, detail="User not authenticated or user ID missing.")

    query = {
        "user_id": str(current_user.id),
        "language_code": current_user.language 
    }
    logger.info(f"[list_my_test_sets] Querying for test sets with: {query}")
    
    test_sets_cursor = db[USER_TEST_SETS_COLLECTION].find(query).sort("upload_timestamp", -1) 
    raw_test_sets = await test_sets_cursor.to_list(length=None) 
    
    logger.info(f"[list_my_test_sets] Found {len(raw_test_sets)} raw test sets.")

    # Validate and prepare response models
    validated_summaries = []
    for ts_doc in raw_test_sets:
        try:
            # Use model_validate for Pydantic v2
            validated_summaries.append(UserTestSetSummary.model_validate(ts_doc))
        except Exception as e:
            logger.error(f"[list_my_test_sets] Failed to validate test set summary for doc _id={ts_doc.get('_id')}: {e}")
            # Optionally skip invalid docs

    # Log the IDs being returned (as strings, since that's how the model encodes them)
    for summary in validated_summaries:
        logger.info(f"[list_my_test_sets] Returning summary with id (str): {summary.id}") 
        
    return validated_summaries

@router.get("/{test_set_id}/entries", response_model=List[TestSetEntryBase])
async def get_test_set_entries(
    test_set_id: str, 
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: User = Depends(get_current_active_user) 
):
    try:
        test_set_uuid = uuid.UUID(test_set_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid test_set_id format. Must be a valid UUID.")

    if not current_user or not current_user.id:
        raise HTTPException(status_code=403, detail="User not authenticated or user ID missing for entries lookup.")

    user_id_str = str(current_user.id)
    logger.info(f"[get_test_set_entries] Looking for test set _id: {test_set_uuid} (type: {type(test_set_uuid)}) required user_id: {user_id_str}")
    
    # --- DEBUGGING: Query by _id only first ---
    logger.info(f"[get_test_set_entries] DEBUG: Querying by _id ONLY: {{'_id': {test_set_uuid}}}")
    test_set_meta_by_id = await db[USER_TEST_SETS_COLLECTION].find_one({"_id": test_set_uuid})

    if not test_set_meta_by_id:
        logger.warning(f"[get_test_set_entries] DEBUG: Metadata NOT FOUND even querying by _id ONLY: {test_set_uuid}")
        # If it's not found by ID alone, the ID itself must be wrong or not in DB
        raise HTTPException(status_code=404, detail=f"Test set with ID {test_set_id} not found.")
    else:
        logger.info(f"[get_test_set_entries] DEBUG: Metadata FOUND querying by _id ONLY.")
        # Now check the user_id found in the document
        found_user_id = test_set_meta_by_id.get("user_id")
        logger.info(f"[get_test_set_entries] DEBUG: User ID found in document: '{found_user_id}' (type: {type(found_user_id)}) vs Required: '{user_id_str}' (type: {type(user_id_str)})" )
        if found_user_id != user_id_str:
            logger.warning(f"[get_test_set_entries] DEBUG: User ID mismatch! Doc has '{found_user_id}', required '{user_id_str}'.")
            raise HTTPException(status_code=403, detail=f"User not authorized for test set {test_set_id}.")
        else:
             logger.info(f"[get_test_set_entries] DEBUG: User ID matches. Proceeding to fetch entries.")
             # Since we found the doc and user matches, proceed to fetch entries
             # Note: We already have test_set_meta_by_id, no need to query again - this was the original query logic path
    
    # Fetch entries for this test set (using the validated test_set_uuid)
    entries_cursor = db[TEST_SET_ENTRIES_COLLECTION].find({"test_set_id": test_set_uuid}).sort("row_number_in_file", 1) 
    raw_entries = await entries_cursor.to_list(length=None)
    logger.info(f"[get_test_set_entries] Found {len(raw_entries)} entries for test_set_id: {test_set_uuid}")

    return [TestSetEntryBase(**entry) for entry in raw_entries] 