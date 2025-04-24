import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import JSONResponse
from pydantic.json import pydantic_encoder
import json
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.models.prompt import Prompt, PromptCreate, PromptUpdate, PyObjectId, PromptSection
from app.models.prompt_history import PromptHistory
from app.db.client import get_database

router = APIRouter()
PROMPT_COLLECTION = "prompts"
HISTORY_COLLECTION = "prompt_history"

logger = logging.getLogger(__name__)

async def _ensure_unique_production_prompt(
    db: AsyncIOMotorDatabase,
    project: Optional[str],
    language: Optional[str],
    exclude_prompt_id: Optional[PyObjectId] = None # Exclude the current prompt if updating
):
    """Helper to set isProduction=False for other prompts in the same project/language."""
    if project and language:
        find_filter = {
            "project": project,
            "language": language,
            "isProduction": True,
        }
        if exclude_prompt_id:
            find_filter["_id"] = {"$ne": exclude_prompt_id}

        # --- Add Log --- M
        update_doc = {"$set": {"isProduction": False, "updated_at": datetime.utcnow()}}
        logger.debug(f"[_ensure_unique_production_prompt] Finding with filter: {find_filter}")
        logger.debug(f"[_ensure_unique_production_prompt] Updating matching with doc: {update_doc}")
        # --- End Log ---

        # Find and update existing production prompts for this combo
        update_result = await db[PROMPT_COLLECTION].update_many(
            find_filter,
            update_doc # Use the logged update_doc
        )
        if update_result.modified_count > 0:
            logger.info(f"Set isProduction=False for {update_result.modified_count} other prompts in project '{project}' / language '{language}'.")

@router.post(
    "/",
    response_model=Prompt,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new prompt",
    description="Adds a new prompt document to the collection.",
)
async def create_prompt(
    prompt_in: PromptCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create a new prompt entry in the database, sets version to 1.0."""
    prompt_dict = prompt_in.model_dump(exclude_unset=True)
    now = datetime.utcnow()
    prompt_dict["created_at"] = now
    prompt_dict["updated_at"] = now
    prompt_dict["version"] = "1.0" # Explicitly set initial version

    # Ensure sections are stored (text is optional in model now)
    if "sections" not in prompt_dict or not prompt_dict["sections"]:
        # Handle case where sections might be empty - perhaps require at least one?
        # For now, allow empty sections list based on model default_factory
        prompt_dict["sections"] = []

    # Text field is optional, remove if not provided or generate if needed
    prompt_dict.pop("text", None) # Remove if present, backend won't store it based on sections

    if prompt_dict.get("isProduction") is True:
        await _ensure_unique_production_prompt(
            db,
            prompt_dict.get("project"),
            prompt_dict.get("language")
        )

    insert_result = await db[PROMPT_COLLECTION].insert_one(prompt_dict)
    created_prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": insert_result.inserted_id})

    if created_prompt_doc:
        return Prompt.model_validate(created_prompt_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create or retrieve the prompt after insertion.",
        )


@router.get(
    "/",
    response_model=List[Prompt],
    summary="Retrieve all prompts",
    description="Gets a list of all prompt documents.",
)
async def read_prompts(
    db: AsyncIOMotorDatabase = Depends(get_database),
    skip: int = 0,
    limit: int = 100,
):
    """Retrieve all prompts from the database with pagination."""
    prompts_cursor = db[PROMPT_COLLECTION].find().skip(skip).limit(limit)
    prompts_raw = await prompts_cursor.to_list(length=limit)
    validated_prompts = []
    for raw_prompt in prompts_raw:
        try:
            validated_prompts.append(Prompt.model_validate(raw_prompt))
        except Exception as e:
            logger.error(f"Failed to validate prompt document with _id {raw_prompt.get('_id')}: {e}")
    return validated_prompts


@router.get(
    "/{prompt_id}",
    response_model=Prompt,
    summary="Retrieve a specific prompt",
    description="Gets a single prompt document by its ID.",
)
async def read_prompt(
    prompt_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Retrieve a single prompt by its ID."""
    prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": prompt_id})
    if prompt_doc:
        return Prompt.model_validate(prompt_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found",
        )


@router.get(
    "/production/",
    response_model=Prompt,
    summary="Get the production prompt for a specific project and language",
    description="Returns the single prompt marked as production for the given project/language combo.",
    responses={404: {"description": "No production prompt found for this combination"}}
)
async def get_production_prompt(
    project: str,
    language: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Retrieve the production prompt for a given project and language."""
    production_prompt_doc = await db[PROMPT_COLLECTION].find_one(
        {"project": project, "language": language, "isProduction": True}
    )
    if production_prompt_doc:
        return Prompt.model_validate(production_prompt_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No production prompt found for project '{project}' and language '{language}'",
        )


@router.put(
    "/{prompt_id}",
    response_model=Prompt,
    summary="Update an existing prompt",
    description="Updates specific fields of a prompt document by its ID.",
)
async def update_prompt(
    prompt_id: PyObjectId,
    prompt_update: PromptUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update an existing prompt, save history, and auto-increment version."""
    update_data = prompt_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided"
        )

    # --- Save current state to history --- M
    current_prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": prompt_id})
    if not current_prompt_doc:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
    try:
        # ... (save to history logic) ...
        history_data = Prompt.model_validate(current_prompt_doc).model_dump(exclude={"id"})
        history_data["prompt_id"] = prompt_id
        await db[HISTORY_COLLECTION].insert_one(history_data)
        logger.info(f"Saved history record for prompt {prompt_id}")
    except Exception as e:
        logger.error(f"Failed to save history for prompt {prompt_id}: {e}")
    # --- End history saving ---

    # --- Auto-increment version --- M
    current_version_str = current_prompt_doc.get("version", "1.0")
    try:
        # Assuming format like "X.0", extract X, increment, format back
        current_major_version = int(float(current_version_str)) # Handle potential X.Y format leniently
        next_version = f"{current_major_version + 1}.0"
    except ValueError:
        logger.warning(f"Could not parse version '{current_version_str}' for prompt {prompt_id}. Defaulting next version to '1.0'")
        next_version = "1.0" # Fallback if parsing fails
    update_data["version"] = next_version # Force the new version
    # --- End version increment ---

    update_data["updated_at"] = datetime.utcnow()

    if "sections" in update_data:
         update_data.pop("text", None)

    # Uniqueness check logic (as before)
    if update_data.get("isProduction") is True:
        project = update_data.get("project")
        language = update_data.get("language")
        if project is None or language is None:
            existing_prompt = await db[PROMPT_COLLECTION].find_one({"_id": prompt_id}, {"project": 1, "language": 1})
            if not existing_prompt:
                 raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found to determine project/language.")
            if project is None: project = existing_prompt.get("project")
            if language is None: language = existing_prompt.get("language")
        await _ensure_unique_production_prompt(db, project, language, exclude_prompt_id=prompt_id)

    # --- End uniqueness check ---

    # Perform the actual update
    # --- Add Logs and Explicit Dict Conversion --- M
    update_data_dict = dict(update_data) # Ensure it's a standard dict
    logger.info(f"[update_prompt] Attempting update for {prompt_id}. Update dict type: {type(update_data_dict)}")
    logger.debug(f"[update_prompt] Update content (wrapped in $set): {{'$set': {update_data_dict}}}")
    # --- End Logs --- M
    update_result = await db[PROMPT_COLLECTION].update_one(
        {"_id": prompt_id},
        {"$set": update_data_dict} # Use the ensured dict
    )

    if update_result.matched_count == 0:
        # This case should be rare now since we fetched the doc before
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found during update.",
        )

    # Return the *updated* document
    updated_prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": prompt_id})
    if updated_prompt_doc:
        return Prompt.model_validate(updated_prompt_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve the prompt after update.",
        )


@router.delete(
    "/{prompt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a prompt",
    description="Removes a prompt document from the collection by its ID.",
)
async def delete_prompt(
    prompt_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete a prompt from the database."""
    delete_result = await db[PROMPT_COLLECTION].delete_one({"_id": prompt_id})

    if delete_result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {prompt_id} not found",
        )

    # No content to return on successful deletion
    return 

@router.get(
    "/{prompt_id}/history",
    response_model=List[PromptHistory],
    summary="Get history for a prompt",
    description="Retrieves all historical versions saved for a specific prompt.",
)
async def get_prompt_history(
    prompt_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Retrieve history records for a given prompt ID, sorted newest first."""
    history_cursor = db[HISTORY_COLLECTION].find(
        {"prompt_id": prompt_id}
    ).sort("saved_at", -1)
    history_docs_raw = await history_cursor.to_list(length=None)

    validated_history = []
    for doc in history_docs_raw:
        try:
            # Validate using Pydantic model
            validated_history.append(PromptHistory.model_validate(doc))
        except Exception as e:
            logger.error(f"Failed to validate history document with _id {doc.get('_id')} for prompt {prompt_id}: {e}")
            # Skip invalid docs for this response

    # --- Return list of validated Pydantic objects --- M
    return validated_history
    # --- End MODIFICATION ---

@router.post(
    "/{prompt_id}/restore/{history_id}",
    response_model=Prompt, # Return the newly restored prompt state
    summary="Restore a prompt to a previous version",
    description="Restores the main prompt document to the state saved in a specific history record.",
)
async def restore_prompt_version(
    prompt_id: PyObjectId,
    history_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Restores a prompt to a specific historical version."""
    # 1. Fetch the history record
    history_doc = await db[HISTORY_COLLECTION].find_one({"_id": history_id, "prompt_id": prompt_id})
    if not history_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"History record {history_id} not found for prompt {prompt_id}",
        )

    # 2. Prepare data for update (exclude history-specific fields)
    try:
        restore_data = PromptHistory.model_validate(history_doc).model_dump(exclude={"id", "prompt_id", "saved_at"})
    except Exception as e:
        logger.error(f"Failed to validate history document {history_id} for restore: {e}")
        raise HTTPException(status_code=500, detail="Failed to process history data for restore.")

    # 3. Save current state to history BEFORE restoring
    current_prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": prompt_id})
    if current_prompt_doc: # Only save if current doc exists
        try:
            current_history_data = Prompt.model_validate(current_prompt_doc).model_dump(exclude={"id"})
            current_history_data["prompt_id"] = prompt_id
            await db[HISTORY_COLLECTION].insert_one(current_history_data)
            logger.info(f"Saved current state to history before restoring prompt {prompt_id} from history {history_id}")
        except Exception as e:
            logger.error(f"Failed to save pre-restore history for prompt {prompt_id}: {e}")
            # Continue with restore even if pre-save fails?

    # 4. Check uniqueness if restoring a version marked as production
    if restore_data.get("isProduction") is True:
        await _ensure_unique_production_prompt(
            db,
            restore_data.get("project"),
            restore_data.get("language"),
            exclude_prompt_id=prompt_id
        )

    # 5. Perform the update (restore)
    restore_data["updated_at"] = datetime.utcnow() # Set updated timestamp
    # --- FIX: Wrap restore_data in $set operator --- M
    update_result = await db[PROMPT_COLLECTION].update_one(
        {"_id": prompt_id},
        {"$set": restore_data} # Correctly use $set here too
    )

    if update_result.matched_count == 0:
         # Should not happen if current_prompt_doc existed or prompt_id is valid
         raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found during restore.")

    # 6. Return the newly restored prompt state
    restored_prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": prompt_id})
    if restored_prompt_doc:
        return Prompt.model_validate(restored_prompt_doc)
    else:
        raise HTTPException(status_code=500, detail="Failed to retrieve prompt after restoring.") 