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
from app.models.prompt import Prompt, PromptCreate, PromptUpdate, PromptSection, BasePromptSummary
from app.db.client import get_database
from app.routes.auth import get_current_active_user
# --- NEW: Prompt Assembler ---
from app.core.prompt_assembler import assemble_prompt
# -----------------------------
from app.models.user import User as UserModel

router = APIRouter()
PROMPT_COLLECTION = "prompts"
HISTORY_COLLECTION = "prompt_history"
EVALUATION_SESSIONS_COLLECTION = "evaluation_sessions"

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
            "is_deleted": False
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

# Helper function to get latest average score for a prompt version
async def get_latest_average_score_for_prompt(db: AsyncIOMotorDatabase, prompt_version_id: PyObjectId) -> Optional[float]:
    pipeline = [
        {
            "$unwind": "$results"
        },
        {
            "$match": {
                "results.promptId": prompt_version_id,
                "results.score": {"$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$_id", 
                "session_saved_at": {"$first": "$saved_at"},
                "scores_for_prompt_in_session": {"$push": "$results.score"}
            }
        },
        {
            "$sort": {"session_saved_at": -1}
        },
        {
            "$limit": 1
        },
        {
            "$project": {
                "_id": 0,
                "average_score": {"$avg": "$scores_for_prompt_in_session"}
            }
        }
    ]
    
    aggregation_result = await db[EVALUATION_SESSIONS_COLLECTION].aggregate(pipeline).to_list(length=1)
    
    if aggregation_result and "average_score" in aggregation_result[0] and aggregation_result[0]["average_score"] is not None:
        return float(aggregation_result[0]["average_score"])
    return None

@router.post(
    "/",
    response_model=Prompt,
    status_code=status.HTTP_201_CREATED,
    summary="Create the first version of a new prompt",
    description="Creates the initial version (v1.0) of a prompt.",
)
async def create_prompt(
    prompt_in: PromptCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Create the first version (1.0) of a new prompt for the current user's language."""
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

    # --- Set Language from User Context --- M
    prompt_dict["language"] = current_user.language
    # --- End Set Language ---

    # Ensure sections are present
    if "sections" not in prompt_dict:
        prompt_dict["sections"] = []

    # --- NEW: Assemble XML prompt text from sections ---
    try:
        # Use the original PromptSection objects from `prompt_in` to avoid re-parsing dicts
        assembled_text = assemble_prompt(prompt_in.sections, current_user.language)
        prompt_dict["text"] = assembled_text
    except Exception as e:
        logger.exception("Failed to assemble XML prompt text")
        raise HTTPException(status_code=500, detail=f"Error assembling prompt XML: {e}")
    # --- End Assembly ---

    # Check production uniqueness
    if prompt_dict.get("isProduction") is True:
        await _ensure_unique_production_prompt(
            db,
            prompt_dict.get("project"),
            prompt_dict.get("language"), # Use language set from user
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
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve the latest version of all prompts with pagination, including their latest average scores from the most recent evaluation session."""
    find_filter = {
        "is_latest": True,
        "language": current_user.language,
        "is_deleted": {"$ne": True}
    }
    logger.info(f"---> read_prompts: Using filter: {find_filter}")
    prompts_cursor = db[PROMPT_COLLECTION].find(find_filter).skip(skip).limit(limit).sort("updated_at", -1)
    prompts_raw = await prompts_cursor.to_list(length=limit)
    logger.info(f"---> read_prompts: Found {len(prompts_raw)} raw prompt documents.")

    prompts_with_scores_raw = []
    for doc in prompts_raw:
        doc["latest_score"] = await get_latest_average_score_for_prompt(db, doc["_id"])
        prompts_with_scores_raw.append(doc)

    validated_prompts = []
    for raw_prompt in prompts_with_scores_raw:
        try:
            validated_prompts.append(Prompt.model_validate(raw_prompt))
        except Exception as e:
            logger.error(f"Failed to validate prompt document with _id {raw_prompt.get('_id')}: {e} --- Document: {raw_prompt}")
    logger.info(f"---> read_prompts: Returning {len(validated_prompts)} validated prompts with scores.")
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
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve a single prompt version by its ID."""
    prompt_doc = await db[PROMPT_COLLECTION].find_one({"_id": version_id, "is_deleted": False})
    if prompt_doc:
        if prompt_doc.get("language") != current_user.language:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not authorized to query this prompt version",
            )
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
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve the production prompt for a given project and language."""
    if language != current_user.language:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not authorized to query production prompts for this language",
        )

    production_prompt_doc = await db[PROMPT_COLLECTION].find_one(
        {"project": project, "language": language, "isProduction": True, "is_deleted": False}
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
    current_user: UserModel = Depends(get_current_active_user)
):
    """Creates a new prompt version, marking previous latest as not latest."""
    logger.info(f"---> save_new_version: Received version_id: {version_id} (Type: {type(version_id)}) update: {prompt_update.model_dump(exclude_unset=True)}")
    # 1. Fetch the document being edited to get base_prompt_id and language
    find_filter = {"_id": version_id, "is_deleted": {"$ne": True}}
    logger.info(f"---> save_new_version: Attempting find_one with filter: {find_filter}")
    base_version_doc = await db[PROMPT_COLLECTION].find_one(
        find_filter # Use the logged filter
    )
    logger.info(f"---> save_new_version: find_one result: {base_version_doc}")

    if not base_version_doc:
        logger.error(f"---> save_new_version: Base version doc {version_id} evaluated as NOT FOUND.")
        raise HTTPException(status_code=404, detail=f"Base prompt version {version_id} not found or has been deleted.")

    # --- ADDED Language Check ---
    base_language = base_version_doc.get("language")
    logger.info(f"---> save_new_version: Language Check. Base Lang: {base_language}, User Lang: {current_user.language} (User: {current_user.username})")
    if base_language != current_user.language:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User cannot edit a prompt from a different language",
        )
    # --- End Language Check ---

    base_prompt_id = base_version_doc.get("base_prompt_id")
    if not base_prompt_id:
        logger.info(f"---> save_new_version: Found base_prompt_id: {base_prompt_id} (Type: {type(base_prompt_id)})")
        raise HTTPException(status_code=500, detail=f"Cannot determine base prompt ID for version {version_id}.")

    # 2. Find the current *non-deleted* latest version for this base_prompt_id
    latest_filter = {"base_prompt_id": base_prompt_id, "is_latest": True, "is_deleted": {"$ne": True}}
    logger.info(f"---> save_new_version: Finding current latest with filter: {latest_filter}")
    current_latest_doc = await db[PROMPT_COLLECTION].find_one(
        latest_filter
    )
    logger.info(f"---> save_new_version: Found current_latest_doc: {current_latest_doc}")

    # It's possible current_latest_doc is None if DB is inconsistent, handle defensively
    current_version_str = current_latest_doc.get("version", "0.0") if current_latest_doc else "0.0"
    logger.info(f"---> save_new_version: Determined current_version_str: {current_version_str}")

    # 3. Increment version number
    try:
        current_major_version = int(float(current_version_str))
        next_version_str = f"{current_major_version + 1}.0"
    except ValueError:
        logger.warning(f"Could not parse version '{current_version_str}' for base prompt {base_prompt_id}. Defaulting next version to '1.0'")
        next_version_str = "1.0"

    # 4. Prepare data for the NEW version document
    new_version_data = prompt_update.model_dump(exclude_unset=True)

    # Copy language and project from base if not provided in the update payload
    if "language" not in new_version_data:
        new_version_data["language"] = base_version_doc.get("language")
    if "project" not in new_version_data:
        new_version_data["project"] = base_version_doc.get("project")
    # --- End field copying ---

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

    # --- NEW: Assemble XML prompt text for the new version ---
    try:
        raw_sections = new_version_data["sections"]
        # Ensure we have PromptSection objects
        sections_models = []
        for item in raw_sections:
            if isinstance(item, PromptSection):
                sections_models.append(item)
            else:
                # Assume dict-like
                sections_models.append(PromptSection(**item))

        assembled_text = assemble_prompt(sections_models, new_version_data.get("language", "en"))
        new_version_data["text"] = assembled_text
    except Exception as e:
        logger.exception("Failed to assemble XML prompt text for new version")
        raise HTTPException(status_code=500, detail=f"Error assembling prompt XML for new version: {e}")
    # --- End Assembly ---

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
    logger.info(f"---> save_new_version: Checking if current_latest_doc exists to update previous. Exists: {current_latest_doc is not None}")
    if current_latest_doc:
        logger.info(f"---> save_new_version: Entering block to update previous latest (ID: {current_latest_doc.get('_id')})")
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
    current_user: UserModel = Depends(get_current_active_user)
):
    """Delete a specific prompt version from the database."""
    # --- ADDED Language Check ---
    # First, find the prompt to check its language
    # MODIFIED AGAIN: Use $ne to handle missing is_deleted field
    prompt_to_delete = await db[PROMPT_COLLECTION].find_one(
        {"_id": prompt_id, "is_deleted": {"$ne": True}}, # Find if not explicitly deleted
        {"language": 1, "is_latest": 1} # Also fetch is_latest for potential future use
    )
    if not prompt_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt version with ID {prompt_id} not found or already deleted",
        )
    if prompt_to_delete.get("language") != current_user.language:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User cannot delete a prompt from a different language",
        )

    # --- MODIFIED: Perform soft delete --- M
    now = datetime.utcnow()
    update_result = await db[PROMPT_COLLECTION].update_one(
        {"_id": prompt_id},
        {"$set": {"is_deleted": True, "deleted_at": now, "is_latest": False}} # Also mark as not latest
    )

    # Check if the update operation modified any document
    if update_result.modified_count == 0:
        # This might happen if the prompt was deleted between the find and update, or if already deleted
        # Re-check if it exists but is deleted
        check_deleted = await db[PROMPT_COLLECTION].find_one({"_id": prompt_id, "is_deleted": True})
        if check_deleted:
             # Already deleted, consider it a success for idempotency?
             return None # FastAPI handles None return with 204 status correctly
        else:
            # Really not found or other issue
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prompt version with ID {prompt_id} not found or could not be marked as deleted",
        )

    # No content to return on successful deletion
    return None # FastAPI handles None return with 204 status correctly

# --- NEW: Endpoint to get all versions for a base prompt --- M
@router.get(
    "/base/{base_prompt_id}/versions",
    response_model=List[Prompt],
    summary="Get all versions for a specific base prompt",
    description="Retrieves all saved versions of a prompt, linked by their common base_prompt_id.",
    responses={404: {"description": "No versions found for this base prompt ID"}}
)
async def get_prompt_versions(
    base_prompt_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve all versions for a given base prompt ID, sorted newest first by creation date, including their latest average scores from the most recent evaluation session."""
    logger.info(f"---> get_prompt_versions: Received base_prompt_id: {base_prompt_id} (Type: {type(base_prompt_id)}) from URL")
    # --- ADDED Language Check ---
    # Need to check the language of *any* non-deleted version associated with this base_prompt_id
    # Fetch one document just to check language (assuming all versions have the same language)
    check_filter = {"base_prompt_id": base_prompt_id, "is_deleted": {"$ne": True}}
    logger.info(f"---> get_prompt_versions: Checking existence with filter: {check_filter}")
    one_version_doc = await db[PROMPT_COLLECTION].find_one(
        check_filter,
        {"language": 1}
    )
    logger.info(f"---> get_prompt_versions: find_one result for check: {one_version_doc}")

    if not one_version_doc:
        logger.error(f"---> get_prompt_versions: base_prompt_id {base_prompt_id} evaluated as NOT FOUND by initial check.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active prompt versions found for base ID '{base_prompt_id}'",
        )
    # Check language against current user
    logger.info(f"---> get_prompt_versions: Checking language. Found: {one_version_doc.get('language')}, User: {current_user.language} (User ID: {current_user.id})")
    if one_version_doc.get("language") != current_user.language:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User cannot view prompt versions from a different language",
        )
    # --- End Language Check ---

    logger.info(f"---> get_prompt_versions: Proceeding to find all versions for base ID: {base_prompt_id}")
    # Find ALL non-deleted documents matching the base_prompt_id
    versions_cursor = db[PROMPT_COLLECTION].find(
        {"base_prompt_id": base_prompt_id, "is_deleted": {"$ne": True}}
    ).sort("created_at", -1)
    versions_raw = await versions_cursor.to_list(length=None)
    logger.info(f"---> get_prompt_versions: Found {len(versions_raw)} raw documents in total.")

    # This is the only other place a 404 could occur
    if not versions_raw:
        logger.error(f"---> get_prompt_versions: versions_raw is EMPTY, raising 404!")
        # This would only happen if find_one found a doc but find didn't, which is highly unlikely
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No prompt versions found for base ID '{base_prompt_id}'", # Message slightly different!
        )

    logger.info(f"---> get_prompt_versions: Starting validation loop for {len(versions_raw)} documents.")
    # Validate each version document and fetch latest score
    validated_versions_with_scores = []
    for doc in versions_raw:
        doc["latest_score"] = await get_latest_average_score_for_prompt(db, doc["_id"])
        try:
            validated_versions_with_scores.append(Prompt.model_validate(doc))
        except Exception as e:
            logger.error(f"---> get_prompt_versions: Failed validation for doc _id={doc.get('_id')}: {e} --- Document: {doc}")

    logger.info(f"---> get_prompt_versions: Finished validation. Returning {len(validated_versions_with_scores)} validated versions with scores.")
    return validated_versions_with_scores
# --- End NEW Endpoint --- 

# --- NEW: Endpoint to get base prompt summaries --- M
@router.get(
    "/base-summaries/",
    response_model=List[BasePromptSummary],
    summary="Retrieve summaries of all base prompts",
    description="Gets a list of summaries for each unique base_prompt_id, representing a conceptual prompt and its versions.",
)
async def read_base_prompt_summaries(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve summaries for all base prompts accessible by the user (based on language)."""
    pipeline = [
        {
            "$match": {
                "language": current_user.language,
                "is_deleted": {"$ne": True}
            }
        },
        {
            "$sort": {"updated_at": -1} # Sort by updated_at to get the latest version's info first within a group
        },
        {
            "$group": {
                "_id": "$base_prompt_id", # Group by the base_prompt_id
                "name": {"$first": "$name"}, # Take the name from the most recently updated version
                "language": {"$first": "$language"}, # Language should be consistent within a base_prompt group
                "project": {"$first": "$project"}, # Take project from the most recently updated version
                "latest_updated_at": {"$first": "$updated_at"} # This will be the latest update time for the group
            }
        },
        {
            "$project": { # Reshape to match BasePromptSummary model
                "base_prompt_id": "$_id",
                "name": 1,
                "language": 1,
                "project": 1,
                "latest_updated_at": 1
            }
        },
        {
            "$sort": {"latest_updated_at": -1} # Optionally sort the final list of base prompts
        }
    ]

    summaries_raw = await db[PROMPT_COLLECTION].aggregate(pipeline).to_list(length=None)
    logger.info(f"---> read_base_prompt_summaries: Found {len(summaries_raw)} raw base prompt summaries.")

    validated_summaries = []
    for raw_summary in summaries_raw:
        try:
            # The _id from grouping is the base_prompt_id
            if raw_summary.get('base_prompt_id') is None:
                logger.warning(f"Skipping summary due to missing base_prompt_id: {raw_summary}")
                continue
            validated_summaries.append(BasePromptSummary.model_validate(raw_summary))
        except Exception as e:
            logger.error(f"Failed to validate base prompt summary: {raw_summary}, Error: {e}")
    
    logger.info(f"---> read_base_prompt_summaries: Returning {len(validated_summaries)} validated summaries.")
    return validated_summaries
# --- End NEW Endpoint --- M 