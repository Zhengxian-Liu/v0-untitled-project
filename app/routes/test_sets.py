from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from typing import List
import json # For parsing mappings if needed, though service handles it

from app.services.test_set_service import process_and_save_test_set
from app.models.test_set_models import UserTestSetInDB, TestSetUploadResponse
from app.models.user import User # Assuming you have this from your auth setup
from app.routes.auth import get_current_active_user # Corrected import path

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
    db = request.app.db # Common way to access DB, adjust if needed
    
    if not current_user or not current_user.id:
        raise HTTPException(status_code=403, detail="User not authenticated or user ID missing.")

    try:
        saved_test_set = await process_and_save_test_set(
            db=db,
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