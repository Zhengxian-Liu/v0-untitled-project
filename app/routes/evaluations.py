import logging
from app.core.prompt_templates import FIXED_OUTPUT_REQUIREMENT_TEMPLATE, TASK_INFO_TEMPLATE
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime
import anthropic # For specific APIError handling
import asyncio # For checking background task completion
from pymongo import ReturnDocument

from app.db.client import get_database
from app.models.common import PyObjectId # Correct import path
from app.models.prompt import Prompt # Only need Prompt model
from app.models.evaluation import (
    Evaluation, EvaluationCreateRequest, EvaluationRequestData,
    EvaluationResult, EvaluationResultCreate, EvaluationResultUpdate,
    EvaluationInDB # Need this for the full data including test_set_data
)
from app.services.claude_service import generate_text_with_claude
from app.routes.auth import get_current_active_user
from app.models.user import User as UserModel
from app.services import judge_service
from app.core.token_utils import estimate_token_count

# +++ ADDED: XML Tag Generation Helpers +++
# Mirrored from frontend logic

def get_tag_name(type_id: str, language: str = "en") -> str:
    # For now, only English tags are defined, mirroring frontend.
    # Expand with language-specific mappings if needed.
    mapping_en = {
        "role": "Role_Definition",
        "context": "Context",
        "instructions": "Instructions",
        "examples": "Examples",
        "output": "Output_Requirements", # Corresponds to 'output' typeId
        "constraints": "Constraints",     # Corresponds to 'constraints' typeId
        # Add other predefined typeIds here if they have fixed tag names
    }
    # Ensure type_id is treated as string and lowercased for matching
    lower_type_id = str(type_id).lower() if type_id else ""
    return mapping_en.get(lower_type_id, "")

def sanitize_tag_name(raw_name: str) -> str:
    if not raw_name or not isinstance(raw_name, str):
        return "Custom_Section" # Default if raw_name is None or not a string
    
    # Replace non-alphanumerics (excluding underscore) with underscore
    tag = "".join(c if c.isalnum() or c == '_' else '_' for c in raw_name.strip())
    
    # Collapse multiple underscores
    import re
    tag = re.sub(r'_+', '_', tag)
    
    # Remove leading/trailing underscores
    tag = tag.strip('_')
    
    # Ensure leading character is a letter, prepend C_ if not or if empty after sanitizing
    if not tag or not tag[0].isalpha():
        tag = f"C_{tag}" if tag else "C_Custom_Section" # Ensure C_ is added if tag became empty
        
    return tag if tag else "Custom_Section" # Final fallback

def get_section_tag(section_type_id: str, section_name: str, language: str = "en") -> str:
    # section is expected to have typeId and name
    # In Python, we'll pass them as separate arguments for clarity
    mapped_tag = get_tag_name(section_type_id, language)
    if mapped_tag:
        return mapped_tag
    return sanitize_tag_name(section_name)

# +++ END ADDED: XML Tag Generation Helpers +++

router = APIRouter()
EVAL_COLLECTION = "evaluations"
RESULTS_COLLECTION = "evaluation_results"
PROMPT_COLLECTION = "prompts"

logger = logging.getLogger(__name__)

# --- Background Task (Modified) --- M

async def run_single_prompt_evaluation_task(
    evaluation_id: PyObjectId,
    prompt_id: PyObjectId, # Specific prompt to run
    db: AsyncIOMotorDatabase,
    test_set_data: List[Dict[str, Any]]
):
    """Background task to evaluate ONE prompt against the test set."""
    logger.info(f"Starting sub-task for Eval ID: {evaluation_id}, Prompt ID: {prompt_id}")
    eval_collection = db[EVAL_COLLECTION]
    results_collection = db[RESULTS_COLLECTION]
    prompt_collection = db[PROMPT_COLLECTION]

    # 1. Use the passed test_set_data
    # Validate the structure? Assume it's correct for now.
    # We can use Pydantic's parse_obj_as if needed: test_set_items = parse_obj_as(List[EvaluationRequestData], test_set_data)

    # 2. Fetch THIS prompt's text
    prompt_record = await prompt_collection.find_one({"_id": prompt_id})
    if not prompt_record:
        logger.error(f"Sub-task failed: Prompt {prompt_id} not found for eval {evaluation_id}.")
        # Store error results?
        for item_dict in test_set_data:
            try: # Add try-except for parsing item_dict
                item = EvaluationRequestData(**item_dict) # Parse dict to model
                error_result = EvaluationResultCreate(
                    evaluation_id=evaluation_id,
                    prompt_id=prompt_id,
                    source_text=item.source_text,
                    model_output=f"ERROR: Prompt {prompt_id} not found.",
                    reference_text=item.reference_text
                )
                await results_collection.insert_one(error_result.model_dump(exclude={"score", "comment"}))
            except Exception as item_parse_err:
                logger.error(f"Failed to parse item_dict when handling prompt not found: {item_parse_err} - Dict: {item_dict}")
        return # Stop this specific task

    # --- Assemble System Prompt --- M
    try:
        prompt_model = Prompt.model_validate(prompt_record)
        prompt_sections = prompt_model.sections if prompt_model.sections else []
        
        # --- NEW XML-based Assembly --- M
        if prompt_sections:
            xml_rules_parts = []
            for sec in prompt_sections:
                # Assuming sec is an object with attributes typeId, name, content
                # The Pydantic model for PromptSection should ensure these attributes exist.
                # If sections come directly from MongoDB dicts, ensure keys match 'typeId', 'name', 'content'.
                # From your provided example, they are indeed typeId, name, content.
                tag = get_section_tag(sec.typeId, sec.name, prompt_model.language or "en") 
                xml_rules_parts.append(f"<{tag}>\n{sec.content}\n</{tag}>")
            rules_text = "\n\n".join(xml_rules_parts)
        else:
            rules_text = "" # No sections, so no rules text.
        # --- END NEW XML-based Assembly --- M
            
        system_prompt = f"{rules_text}\n\n{FIXED_OUTPUT_REQUIREMENT_TEMPLATE}"
    except Exception as prompt_parse_err:
        logger.error(f"Failed to parse prompt record or assemble system prompt for {prompt_id}: {prompt_parse_err}", exc_info=True)
        # Mark all results for this prompt as failed
        await results_collection.update_many(
            {"evaluation_id": evaluation_id, "prompt_id": prompt_id},
            {"$set": {"model_output": f"ERROR: Failed to process prompt {prompt_id}."}}
        )
        # Increment completed tasks counter here as we are done processing this prompt (even though it failed)
        await eval_collection.update_one(
            {"_id": evaluation_id},
            {"$inc": {"completed_prompt_tasks": 1}}
        )
        return # Stop this task
    # --- End System Prompt Assembly ---

    # --- Calculate System Prompt Tokens --- M
    # (Do this once per prompt, outside the item loop)
    system_token_count = estimate_token_count(system_prompt)
    # --- End System Prompt Assembly ---

    # 3. Iterate test set and call Claude API
    task_has_errors = False
    for index, item_dict in enumerate(test_set_data):
        result_id = None # Initialize result_id for potential error logging
        model_output = None
        try:
            item = EvaluationRequestData(**item_dict) # Parse dict to model
            result_id = item_dict.get("_id") # Assuming results were pre-created and have IDs

            # --- Get Contextual Data --- M
            previous_context = test_set_data[index - 1].get("source_text", "N/A") if index > 0 else "N/A"
            following_context = test_set_data[index + 1].get("source_text", "N/A") if index < len(test_set_data) - 1 else "N/A"
            additional_instructions = item.additional_instructions if item.additional_instructions else "N/A"
            # --- End Contextual Data ---

            # --- Assemble User Prompt for this item --- M
            user_prompt = TASK_INFO_TEMPLATE
            user_prompt = user_prompt.replace("{SOURCE_TEXT}", item.source_text)
            user_prompt = user_prompt.replace("{PREVIOUS_CONTEXT}", previous_context)
            user_prompt = user_prompt.replace("{FOLLOWING_CONTEXT}", following_context)
            user_prompt = user_prompt.replace("{TARGET_LANGUAGE}", prompt_model.language or "Unknown")
            user_prompt = user_prompt.replace("{TERMINOLOGY}", "[]") # TODO
            user_prompt = user_prompt.replace("{SIMILAR_TRANSLATIONS}", "[]") # TODO
            user_prompt = user_prompt.replace("{ADDITIONAL_INSTRUCTIONS}", additional_instructions)
            # --- End User Prompt Assembly ---

            # --- Calculate User/Total Tokens --- M
            user_token_count = estimate_token_count(user_prompt)
            total_token_count = system_token_count + user_token_count
            # --- End Token Calculation ---

            # --- ADDED: Log full assembled prompts for debugging --- M
            logger.debug(f"--- System Prompt for Eval {evaluation_id}, Prompt {prompt_id} ({system_token_count} tokens) ---\n{system_prompt}\n--------------------")
            logger.debug(f"--- User Prompt for Eval {evaluation_id}, Prompt {prompt_id}, Source '{item.source_text[:30]}...' ({user_token_count} tokens) ---\n{user_prompt}\n--------------------")
            # --- End Log --- M

            # Call Claude service with separate system and user prompts
            model_output_raw = await generate_text_with_claude(
                prompt_text=system_prompt, 
                source_text=user_prompt
            )

            # --- Extract text from <translated_text> tags --- M
            start_tag = "<translated_text>"
            end_tag = "</translated_text>"
            start_index = model_output_raw.find(start_tag)
            end_index = model_output_raw.find(end_tag)
            if start_index != -1 and end_index != -1:
                model_output = model_output_raw[start_index + len(start_tag):end_index].strip()
            else:
                logger.warning(f"Could not find {start_tag}...{end_tag} in output for eval {evaluation_id}, prompt {prompt_id}, source '{item.source_text[:20]}...'. Using raw output.")
                model_output = model_output_raw # Fallback to raw output
            # --- End Extraction ---

            logger.debug(f"Eval {evaluation_id}, Prompt {prompt_id}: Generated output for source: '{item.source_text[:30]}...'")
        except Exception as e: # Catch any exception from service or prompt assembly
            # FIX: Safely log error without assuming 'item' exists yet
            source_preview = item_dict.get("source_text")[:30] if isinstance(item_dict, dict) else "<unknown source>"
            logger.error(f"Eval {evaluation_id}, Prompt {prompt_id}: Claude API or processing error for source '{source_preview}...': {e}", exc_info=True)
            task_has_errors = True
            model_output = f"ERROR: {e}"

        # 4. Store the result with prompt_id
        # NOTE: This assumes results are created upfront and we UPDATE them.
        # If results are created here, the logic needs adjustment.
        # We need the result_id to update the correct document.
        
        # TEMPORARY: Assuming results are created here for now. Find existing or create new?
        # Let's stick to the original logic: Create result here.
        result_data = EvaluationResultCreate(
            evaluation_id=evaluation_id,
            prompt_id=prompt_id, # Store which prompt generated this
            source_text=item.source_text,
            model_output=model_output,
            reference_text=item.reference_text,
            # --- Store Sent Prompts and Tokens --- M
            sent_system_prompt=system_prompt,
            sent_user_prompt=user_prompt,
            prompt_token_count=total_token_count
            # --- End Store ---
        )
        # Perform insert instead of update
        await results_collection.insert_one(result_data.model_dump(exclude={"score", "comment"}))

    # --- Status Update (Handled by coordinating task/endpoint) ---
    # This task only logs completion/errors. The main evaluation status is updated elsewhere.
    status_msg = "errors" if task_has_errors else "success"
    logger.info(f"Finished sub-task for Eval ID: {evaluation_id}, Prompt ID: {prompt_id} with status: {status_msg}")
    # We need a way to signal completion back to the parent eval record or a monitoring task.
    # Simplest for now: update a field in the parent eval record.
    # This might lead to race conditions if not handled carefully.
    await eval_collection.update_one(
        {"_id": evaluation_id},
        {"$inc": {"completed_prompt_tasks": 1}} # Increment a counter
    )

# --- LLM Judge Background Task --- M
async def run_llm_judging_task(
    evaluation_id: PyObjectId,
    db: AsyncIOMotorDatabase
):
    """Background task to run LLM judge on all results for an evaluation."""
    logger.info(f"[LLM Judge Task] Starting for Evaluation ID: {evaluation_id}")
    eval_collection = db[EVAL_COLLECTION]
    results_collection = db[RESULTS_COLLECTION]

    results_cursor = results_collection.find({"evaluation_id": evaluation_id})
    results_to_judge = await results_cursor.to_list(length=None) # Fetch all results

    if not results_to_judge:
        logger.warning(f"[LLM Judge Task] No results found for Evaluation ID: {evaluation_id}. Aborting.")
        await eval_collection.update_one(
            {"_id": evaluation_id},
            {"$set": {"judge_status": "failed", "judged_at": datetime.utcnow()}}
        )
        return

    total_results = len(results_to_judge)
    processed_count = 0
    error_count = 0
    judge_model_id_used = judge_service.DEFAULT_JUDGE_MODEL_ID # Track default used

    logger.info(f"[LLM Judge Task] Found {total_results} results to judge for Evaluation ID: {evaluation_id}")

    for result_doc in results_to_judge:
        result_id = result_doc["_id"]
        logger.debug(f"[LLM Judge Task] Judging result ID: {result_id}")
        try:
            # Prepare inputs for the judge service
            source_text = result_doc.get("source_text")
            model_output = result_doc.get("model_output")
            reference_text = result_doc.get("reference_text")
            reference_materials = {"human_reference": reference_text} if reference_text else {}

            if not source_text or model_output is None: # Check if model_output is None or empty string
                 logger.warning(f"[LLM Judge Task] Skipping result {result_id} due to missing source or output.")
                 update_payload = {"$set": {
                      "llm_judge_error": "Skipped: Missing source or model output."
                 }}
                 error_count += 1 # Count as error for status reporting
            else:
                 # Call the judge service function
                 # TODO: Allow passing judge_model_id and template from API request later
                 judge_result = await judge_service.evaluate_translation(
                     source_text=source_text,
                     model_output=model_output,
                     reference_materials=reference_materials,
                     # judge_model_id=... # Use default for now
                     # criteria_prompt_template=... # Use default for now
                 )
                 judge_model_id_used = judge_result.get("judge_model_id", judge_model_id_used)

                 # Prepare update payload based on judge result
                 update_payload = {"$set": {
                     "llm_judge_score": judge_result.get("score"),
                     "llm_judge_rationale": judge_result.get("rationale"),
                     "llm_judge_model_id": judge_model_id_used,
                     # Optionally store error or status per result
                     "llm_judge_error": judge_result.get("error_message") if judge_result.get("status") == "error" else None
                 }}

                 if judge_result.get("status") == "error":
                     error_count += 1

            # Update the specific EvaluationResult document
            await results_collection.update_one({"_id": result_id}, update_payload)
            processed_count += 1
            logger.debug(f"[LLM Judge Task] Updated result {result_id} ({processed_count}/{total_results})")

        except Exception as e:
            logger.error(f"[LLM Judge Task] Unexpected error processing result {result_id}: {e}", exc_info=True)
            error_count += 1
            # Attempt to mark the result as failed
            try:
                await results_collection.update_one(
                    {"_id": result_id},
                    {"$set": {"llm_judge_error": f"Unexpected task error: {e}"}}
                )
            except Exception as update_err:
                 logger.error(f"[LLM Judge Task] Failed to update error status for result {result_id}: {update_err}")

    # --- Final Evaluation Status Update --- M
    final_judge_status = "failed" if error_count > 0 else "completed"
    logger.info(f"[LLM Judge Task] Finished for Eval ID: {evaluation_id}. Status: {final_judge_status}, Errors: {error_count}/{total_results}")
    await eval_collection.update_one(
        {"_id": evaluation_id},
        {"$set": {"judge_status": final_judge_status, "judged_at": datetime.utcnow()}}
    )
# --- End LLM Judge Background Task ---

# --- API Endpoints (Modified) --- M

@router.post(
    "/",
    response_model=Evaluation,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start a new multi-prompt evaluation session",
    description="Accepts evaluation details for multiple prompts and schedules background processing.",
)
async def create_evaluation(
    eval_request: EvaluationCreateRequest, # Now expects prompt_ids list
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Initiate an evaluation run for multiple prompts."""
    # 1. Validate all prompt IDs exist AND belong to the current user's language
    prompt_ids = eval_request.prompt_ids
    found_prompts_cursor = db[PROMPT_COLLECTION].find(
        {"_id": {"$in": prompt_ids}},
        {"language": 1} # Only fetch language for checking
    )
    found_prompts = await found_prompts_cursor.to_list(length=len(prompt_ids))

    if len(found_prompts) != len(prompt_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more specified prompt IDs were not found.",
        )

    # Check language consistency
    first_prompt_language = None
    for prompt in found_prompts:
        lang = prompt.get("language")
        if lang != current_user.language:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Prompt ID {prompt.get('_id')} does not belong to the user's language."
            )
        if first_prompt_language is None:
            first_prompt_language = lang
        elif lang != first_prompt_language:
            # This ensures all prompts in the eval belong to the *same* language (the user's)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All prompts in an evaluation must belong to the same language."
            )

    # 2. Create the main Evaluation record
    eval_data_dict = {
        "prompt_ids": prompt_ids, # Store list of IDs
        "test_set_name": eval_request.test_set_name,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "test_set_data": [item.model_dump() for item in eval_request.test_set_data],
        "total_prompt_tasks": len(prompt_ids), # Store how many tasks to expect
        "completed_prompt_tasks": 0, # Initialize completion counter
        "user_id": current_user.id # ADDED: Link evaluation to user
    }
    insert_result = await db[EVAL_COLLECTION].insert_one(eval_data_dict)
    created_eval_id = insert_result.inserted_id

    # 3. Schedule background task for EACH prompt
    for prompt_id in prompt_ids:
        # FIX: Pass list of dicts, not list of models, to background task
        test_set_data_dicts = [item.model_dump() for item in eval_request.test_set_data]
        background_tasks.add_task(run_single_prompt_evaluation_task, created_eval_id, prompt_id, db, test_set_data_dicts)
    logger.info(f"Scheduled {len(prompt_ids)} background sub-tasks for Evaluation ID: {created_eval_id}")

    # --- Set status to running (after scheduling) --- M
    await db[EVAL_COLLECTION].update_one(
        {"_id": created_eval_id, "status": "pending"}, # Ensure we only update if still pending
        {"$set": {"status": "running"}}
    )
    # --- End Status Update ---

    # 4. Return the created Evaluation record
    # Fetch again to get potentially updated status
    created_eval_record = await db[EVAL_COLLECTION].find_one({"_id": created_eval_id})
    if created_eval_record:
        return Evaluation(**created_eval_record) # Use base Evaluation model
    else:
        raise HTTPException(status_code=500, detail="Failed to retrieve evaluation record after creation.")

# --- Endpoint to Check Status (Potentially Needed) --- M
@router.patch(
    "/{evaluation_id}/check_completion",
    response_model=Evaluation,
    summary="Check and potentially update evaluation status to completed",
    description="Checks if all sub-tasks are finished and updates the main status."
)
async def check_evaluation_completion(
    evaluation_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Checks if completed_tasks matches total_tasks and updates status."""
    eval_record = await db[EVAL_COLLECTION].find_one({"_id": evaluation_id})
    if not eval_record:
        raise HTTPException(status_code=404, detail=f"Evaluation {evaluation_id} not found")

    # --- ADDED Authorization Check --- M
    if eval_record.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not authorized to access this evaluation",
        )
    # --- End Authorization Check ---

    if eval_record.get("status") in ["pending", "running"]:
        total = eval_record.get("total_prompt_tasks", 0)
        completed = eval_record.get("completed_prompt_tasks", 0)
        if completed >= total > 0:
            logger.info(f"Marking evaluation {evaluation_id} as completed.")
            update_filter = {"_id": evaluation_id, "status": {"$in": ["pending", "running"]}}
            update_payload = {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
            try:
                updated_eval_record = await db[EVAL_COLLECTION].find_one_and_update(
                     update_filter,
                     update_payload,
                     return_document=ReturnDocument.AFTER
                )
                if updated_eval_record:
                     logger.info(f"Successfully marked evaluation {evaluation_id} as completed.")
                     eval_record = updated_eval_record
                else:
                     logger.info(f"Evaluation {evaluation_id} status was likely already completed/failed before update attempt.")
                     # Fetch again even if update didn't modify, to get latest judge_status etc.
                     # eval_record = await db[EVAL_COLLECTION].find_one({\"_id\": evaluation_id})

            except ValueError as e:
                 logger.error(f"!!! CAUGHT ValueError during find_one_and_update for eval completion ({evaluation_id}) !!!")
                 logger.exception("ValueError details:")
                 raise HTTPException(status_code=500, detail="Internal error updating evaluation status (ValueError).")
            except Exception as e:
                 logger.error(f"!!! CAUGHT unexpected Exception during find_one_and_update for eval completion ({evaluation_id}) !!!")
                 logger.exception("Unexpected Exception details:")
                 raise HTTPException(status_code=500, detail="Internal error updating evaluation status (Exception).")

    # --- Ensure we return the LATEST state --- M
    # Refetch the record regardless of status changes to ensure we have latest judge_status etc.
    final_eval_record = await db[EVAL_COLLECTION].find_one({"_id": evaluation_id})
    if not final_eval_record:
         # This case should be rare if it existed before, but handle it.
         logger.error(f"Evaluation {evaluation_id} disappeared after status check!")
         raise HTTPException(status_code=404, detail=f"Evaluation {evaluation_id} not found after update check")

    return Evaluation(**final_eval_record) # Return the freshly fetched record

@router.get(
    "/",
    response_model=List[Evaluation],
    summary="List all evaluation sessions",
    description="Retrieves a list of all evaluation sessions (without results data)."
)
async def list_evaluations(
    db: AsyncIOMotorDatabase = Depends(get_database),
    skip: int = 0,
    limit: int = 100,
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve all evaluation sessions from the database."""
    evals_cursor = db[EVAL_COLLECTION].find({"user_id": current_user.id}).sort("created_at", -1).skip(skip).limit(limit)
    evaluations = await evals_cursor.to_list(length=limit)
    # Use Evaluation model which excludes test_set_data
    return [Evaluation(**e) for e in evaluations]

@router.get(
    "/{evaluation_id}",
    response_model=Evaluation,
    summary="Get details of an evaluation session",
    description="Retrieves details for a specific evaluation session (without results data)."
)
async def get_evaluation(
    evaluation_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve a single evaluation session by its ID."""
    evaluation = await db[EVAL_COLLECTION].find_one({"_id": evaluation_id})
    if evaluation:
        # --- ADDED Authorization Check --- M
        if evaluation.get("user_id") != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not authorized to access this evaluation",
            )
        # --- End Authorization Check ---

        # Use Evaluation model which excludes test_set_data
        return Evaluation(**evaluation)
    else:
        raise HTTPException(status_code=404, detail=f"Evaluation {evaluation_id} not found")


@router.get(
    "/{evaluation_id}/results",
    response_model=List[EvaluationResult],
    summary="Get results for an evaluation session",
    description="Retrieves all result rows associated with a specific evaluation session.",
)
async def get_evaluation_results(
    evaluation_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Retrieve all results for a given evaluation ID."""
    # --- ADDED Authorization Check (on parent evaluation) --- M
    parent_eval = await db[EVAL_COLLECTION].find_one(
        {"_id": evaluation_id},
        {"user_id": 1} # Only fetch user_id for check
    )
    if not parent_eval:
        raise HTTPException(status_code=404, detail=f"Evaluation {evaluation_id} not found")
    if parent_eval.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not authorized to access results for this evaluation",
        )
    # --- End Authorization Check ---

    results_cursor = db[RESULTS_COLLECTION].find({"evaluation_id": evaluation_id})
    results = await results_cursor.to_list(length=None)
    return [EvaluationResult.model_validate(res) for res in results]


@router.put(
    "/results/{result_id}",
    response_model=EvaluationResult,
    summary="Update score/comment for an evaluation result",
    description="Updates the manual score and/or comment for a single evaluation result row.",
)
async def update_evaluation_result(
    result_id: PyObjectId,
    result_update: EvaluationResultUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Update the score or comment for a specific evaluation result."""
    # --- ADDED Authorization Check (on parent evaluation) --- M
    # 1. Get the result to find its parent evaluation ID
    result_doc = await db[RESULTS_COLLECTION].find_one(
        {"_id": result_id},
        {"evaluation_id": 1} # Only fetch eval_id
    )
    if not result_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation result with ID {result_id} not found",
        )
    parent_eval_id = result_doc.get("evaluation_id")
    if not parent_eval_id:
        # Should not happen if data is consistent
        raise HTTPException(status_code=500, detail=f"Result {result_id} is missing parent evaluation ID.")

    # 2. Get the parent evaluation to check its user_id
    parent_eval = await db[EVAL_COLLECTION].find_one(
        {"_id": parent_eval_id},
        {"user_id": 1} # Only fetch user_id
    )
    if not parent_eval:
        # Should not happen if data is consistent
        raise HTTPException(status_code=404, detail=f"Parent evaluation {parent_eval_id} not found for result {result_id}")
    if parent_eval.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not authorized to update results for this evaluation",
        )
    # --- End Authorization Check ---

    update_data = result_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No score or comment data provided"
        )

    update_result = await db[RESULTS_COLLECTION].update_one(
        {"_id": result_id},
        {"$set": update_data}
    )

    if update_result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation result with ID {result_id} not found",
        )

    updated_result = await db[RESULTS_COLLECTION].find_one({"_id": result_id})
    if updated_result:
        return EvaluationResult(**updated_result)
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve evaluation result after update."
        )

# --- API Endpoint to Trigger Judging --- M
@router.post(
    "/{evaluation_id}/judge",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start LLM Judging for an Evaluation",
    description="Triggers a background task to evaluate all results of an evaluation using an LLM judge.",
    responses={
        404: {"description": "Evaluation not found"},
        403: {"description": "User not authorized"},
        409: {"description": "Judging already in progress or completed"}
    }
)
async def trigger_llm_judging(
    evaluation_id: PyObjectId,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Initiates the LLM judging process for a given evaluation ID."""

    # 1. Fetch parent evaluation
    evaluation = await db[EVAL_COLLECTION].find_one({"_id": evaluation_id})
    if not evaluation:
        raise HTTPException(status_code=404, detail=f"Evaluation {evaluation_id} not found")

    # 2. Authorization check
    if evaluation.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="User not authorized to judge this evaluation")

    # 3. Check current judge status (optional: allow re-judging?)
    current_judge_status = evaluation.get("judge_status")
    if current_judge_status not in [None, "failed", "not_started"]: # Allow running if failed or never run
         raise HTTPException(
             status_code=status.HTTP_409_CONFLICT,
             detail=f"LLM Judging for evaluation {evaluation_id} is already '{current_judge_status}'."
         )

    # 4. Update status to pending and schedule task
    update_result = await db[EVAL_COLLECTION].update_one(
        {"_id": evaluation_id},
        {"$set": {"judge_status": "pending"}}
    )

    if update_result.modified_count == 0:
        # Should not happen if checks above passed, but handle defensively
        logger.error(f"Failed to update judge_status to pending for evaluation {evaluation_id}")
        raise HTTPException(status_code=500, detail="Failed to initiate judging process.")

    background_tasks.add_task(run_llm_judging_task, evaluation_id, db)
    logger.info(f"Scheduled LLM judging task for Evaluation ID: {evaluation_id}")

    return {"message": "LLM judging process initiated."}
# --- End Trigger Endpoint ---

# --- REMOVED: Status Check Endpoint (Using check_completion instead) --- M 