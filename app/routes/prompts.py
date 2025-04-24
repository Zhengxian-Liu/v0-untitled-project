import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import JSONResponse
from pydantic.json import pydantic_encoder
import json
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.models.common import PyObjectId
from app.models.prompt import Prompt, PromptCreate, PromptUpdate, PromptSection
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
    summary="Create the first version of a new prompt",
    description="Creates the initial version (v1.0) of a prompt.",
)
async def create_prompt(
    prompt_in: PromptCreate, # Uses PromptCreate model
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create the first version (1.0) of a new prompt."""
    prompt_dict = prompt_in.model_dump(exclude_unset=True)
    now = datetime.utcnow()

    # --- Set versioning fields for the first version --- M
    new_id = ObjectId() # Generate the ID for this first version
    prompt_dict["_id"] = new_id
    prompt_dict["base_prompt_id"] = new_id # First version's base ID is its own ID
    prompt_dict["version"] = "1.0"
    prompt_dict["is_latest"] = True
    prompt_dict["created_at"] = now
    prompt_dict["updated_at"] = now
    # --- End versioning fields --- M

    # Ensure sections are present
    if "sections" not in prompt_dict:
        prompt_dict["sections"] = []
    # Text is optional and not explicitly set here

    # Check production uniqueness (if applicable on first creation)
    if prompt_dict.get("isProduction") is True:
        await _ensure_unique_production_prompt(
            db,
            prompt_dict.get("project"),
            prompt_dict.get("language"),
            # No need to exclude ID on create
        )

    # Insert the new version document
    insert_result = await db[PROMPT_COLLECTION].insert_one(prompt_dict)
    if not insert_result.inserted_id:
         raise HTTPException(status_code=500, detail="Failed to insert new prompt version.")

    # Fetch the document we just inserted to return
    created_prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": insert_result.inserted_id})
    if created_prompt_doc:
        # Validate and return using the Prompt model
        return Prompt.model_validate(created_prompt_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve the prompt after insertion.",
        )


@router.get(
    "/",
    response_model=List[Prompt],
    summary="Retrieve latest versions of all prompts",
    description="Gets a list of the latest version of each prompt document.",
)
async def read_prompts(
    db: AsyncIOMotorDatabase = Depends(get_database),
    skip: int = 0,
    limit: int = 100,
):
    """Retrieve the latest version of all prompts with pagination."""
    # --- Add is_latest filter --- M
    prompts_cursor = db[PROMPT_COLLECTION].find({"is_latest": True}).skip(skip).limit(limit)
    # --- End filter ---
    prompts_raw = await prompts_cursor.to_list(length=limit)
    validated_prompts = []
    for raw_prompt in prompts_raw:
        try:
            validated_prompts.append(Prompt.model_validate(raw_prompt))
        except Exception as e:
            logger.error(f"Failed to validate prompt document with _id {raw_prompt.get('_id')}: {e}")
    return validated_prompts


@router.get(
    "/{version_id}",
    response_model=Prompt,
    summary="Retrieve a specific prompt version",
    description="Gets a single prompt version document by its specific version ID.",
)
async def read_prompt(
    version_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Retrieve a single prompt version by its ID."""
    prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": version_id})
    if prompt_doc:
        return Prompt.model_validate(prompt_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt version with ID {version_id} not found",
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
        # --- FIX: Use model_validate --- M
        return Prompt.model_validate(production_prompt_doc)
        # --- End FIX ---
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No production prompt found for project '{project}' and language '{language}'",
        )


@router.put(
    "/{version_id}", # Path parameter is the ID of the version being edited
    response_model=Prompt, # Returns the NEWLY created version
    summary="Save a new version based on an existing one",
    description="Creates a new prompt version document based on the provided data and the specified base version.",
)
async def save_new_version_from_existing(
    version_id: PyObjectId, # ID of the prompt version being edited/saved from
    prompt_update: PromptUpdate, # Contains the *new* desired state
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Creates a new prompt version, marking previous latest as not latest."""
    # 1. Fetch the document being edited to get base_prompt_id
    base_version_doc = await db[PROMPT_COLLECTION].find_one({"_id": version_id})
    if not base_version_doc:
        raise HTTPException(status_code=404, detail=f"Base prompt version {version_id} not found.")

    base_prompt_id = base_version_doc.get("base_prompt_id")
    if not base_prompt_id:
         # Should not happen if created correctly
         raise HTTPException(status_code=500, detail=f"Cannot determine base prompt ID for version {version_id}.")

    # 2. Find the current latest version for this base_prompt_id
    current_latest_doc = await db[PROMPT_COLLECTION].find_one(
        {"base_prompt_id": base_prompt_id, "is_latest": True}
    )
    # It's possible current_latest_doc is None if DB is inconsistent, handle defensively
    current_version_str = current_latest_doc.get("version", "0.0") if current_latest_doc else "0.0"

    # 3. Increment version number
    try:
        current_major_version = int(float(current_version_str))
        next_version_str = f"{current_major_version + 1}.0"
    except ValueError:
        logger.warning(f"Could not parse version '{current_version_str}' for base prompt {base_prompt_id}. Defaulting next version to '1.0'")
        next_version_str = "1.0"

    # 4. Prepare data for the NEW version document
    new_version_data = prompt_update.model_dump(exclude_unset=True)
    new_version_data["base_prompt_id"] = base_prompt_id
    new_version_data["version"] = next_version_str
    new_version_data["is_latest"] = True
    now = datetime.utcnow()
    # created_at for the new version is now, updated_at is also now
    new_version_data["created_at"] = now
    new_version_data["updated_at"] = now
    # Ensure sections are present if not explicitly provided in update
    if "sections" not in new_version_data:
         new_version_data["sections"] = base_version_doc.get("sections", []) # Copy from base if missing

    # 5. Check production uniqueness for the NEW version
    if new_version_data.get("isProduction") is True:
        await _ensure_unique_production_prompt(
            db,
            new_version_data.get("project", base_version_doc.get("project")), # Use new or old value
            new_version_data.get("language", base_version_doc.get("language")),
            # Don't exclude any ID here, we want to unset the current latest if needed
        )

    # 6. Insert the NEW version document
    insert_result = await db[PROMPT_COLLECTION].insert_one(new_version_data)
    new_version_id = insert_result.inserted_id
    if not new_version_id:
        raise HTTPException(status_code=500, detail="Failed to insert new prompt version.")

    # 7. Update the PREVIOUS latest version to set is_latest=False
    if current_latest_doc:
        previous_latest_id = current_latest_doc["_id"]
        update_filter = {"_id": previous_latest_id}
        # --- Use the original update payload including timestamp --- M
        update_payload = {"$set": {"is_latest": False, "updated_at": now}}
        # --- End payload change ---

        logger.info(f"---> Attempting to find_one_and_update previous latest ({previous_latest_id}) with filter: {update_filter}")
        logger.info(f"---> Update payload for previous latest: {update_payload}")
        try:
            # --- MODIFIED: Use find_one_and_update --- M
            update_result = await db[PROMPT_COLLECTION].find_one_and_update(
                update_filter,
                update_payload,
                # return_document=ReturnDocument.AFTER # Optional: if we needed the updated doc
            )
            # Check if the document was found and potentially updated
            if update_result is None:
                 logger.warning(f"find_one_and_update did not find document {previous_latest_id} to update.")
            else:
                logger.info(f"---> Successfully updated is_latest=False for {previous_latest_id} via find_one_and_update")
            # --- End MODIFICATION ---
        except ValueError as e:
             # ... (keep existing ValueError logging) ...
             logger.error(f"!!! CAUGHT ValueError during find_one_and_update for previous latest ({previous_latest_id}) !!!")
             logger.error(f"!!! Filter used: {update_filter}")
             logger.error(f"!!! Payload used: {update_payload}")
             logger.exception("ValueError details:")
             raise HTTPException(status_code=500, detail=f"Internal error updating previous prompt version status (ValueError: {e})") # Added detail
        except Exception as e:
            # ... (keep existing Exception logging) ...
            logger.error(f"!!! CAUGHT unexpected Exception during find_one_and_update for previous latest ({previous_latest_id}) !!!")
            logger.exception("Unexpected Exception details:")
            raise HTTPException(status_code=500, detail=f"Internal error updating previous prompt version status (Exception: {e})")

    else:
        logger.warning(f"Could not find a previous latest version for base_prompt_id {base_prompt_id} while saving new version {new_version_id}.")

    # 8. Return the NEWLY created version document
    newly_created_doc = await db[PROMPT_COLLECTION].find_one({"_id": new_version_id})
    if newly_created_doc:
        return Prompt.model_validate(newly_created_doc)
    else:
        # Should not happen
        raise HTTPException(status_code=500, detail="Failed to retrieve newly created prompt version.")


@router.delete(
    "/{prompt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a prompt version",
    description="Removes a specific prompt version document from the collection by its ID.",
)
async def delete_prompt(
    prompt_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete a specific prompt version from the database."""
    delete_result = await db[PROMPT_COLLECTION].delete_one({"_id": prompt_id})

    if delete_result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt version with ID {prompt_id} not found",
        )

    # No content to return on successful deletion
    return 