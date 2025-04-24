import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from typing import List
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

router = APIRouter()
EVAL_COLLECTION = "evaluations"
RESULTS_COLLECTION = "evaluation_results"
PROMPT_COLLECTION = "prompts"

logger = logging.getLogger(__name__)

# --- Background Task (Modified) --- M

async def run_single_prompt_evaluation_task(
    evaluation_id: PyObjectId,
    prompt_id: PyObjectId, # Specific prompt to run
    db: AsyncIOMotorDatabase
):
    """Background task to evaluate ONE prompt against the test set."""
    logger.info(f"Starting sub-task for Eval ID: {evaluation_id}, Prompt ID: {prompt_id}")
    eval_collection = db[EVAL_COLLECTION]
    results_collection = db[RESULTS_COLLECTION]
    prompt_collection = db[PROMPT_COLLECTION]

    # 1. Fetch the PARENT evaluation record to get test data
    eval_record_dict = await eval_collection.find_one({"_id": evaluation_id})
    if not eval_record_dict:
        logger.error(f"Sub-task failed: Eval record {evaluation_id} not found.")
        # Cannot update status easily here, rely on main task logic or timeout
        return
    try:
        eval_record = EvaluationInDB(**eval_record_dict)
    except Exception as e:
        logger.error(f"Sub-task failed: Could not parse eval record {evaluation_id}. Error: {e}")
        return

    # 2. Fetch THIS prompt's text
    prompt_record = await prompt_collection.find_one({"_id": prompt_id})
    if not prompt_record:
        logger.error(f"Sub-task failed: Prompt {prompt_id} not found for eval {evaluation_id}.")
        # Log error for this prompt, other tasks might continue
        # Store error results?
        for item in eval_record.test_set_data:
             error_result = EvaluationResultCreate(
                 evaluation_id=evaluation_id,
                 prompt_id=prompt_id,
                 source_text=item.source_text,
                 model_output=f"ERROR: Prompt {prompt_id} not found.",
                 reference_text=item.reference_text
             )
             await results_collection.insert_one(error_result.model_dump(exclude={"score", "comment"}))
        return # Stop this specific task
    # --- FIX: Add inline section assembly --- M
    # Use Prompt model validation to easily access fields
    prompt_model = Prompt.model_validate(prompt_record)
    # Simple assembly:
    prompt_sections = prompt_model.sections if prompt_model.sections else []
    prompt_text = "\n\n".join([f"### {sec.name}\n{sec.content}" for sec in prompt_sections])
    # --- End FIX ---

    # 3. Iterate test set and call Claude API
    task_has_errors = False
    for item in eval_record.test_set_data:
        model_output = None
        try:
            model_output = await generate_text_with_claude(prompt_text, item.source_text)
            logger.debug(f"Eval {evaluation_id}, Prompt {prompt_id}: Generated output for source: '{item.source_text[:30]}...'")
        except Exception as e: # Catch any exception from service
            logger.error(f"Eval {evaluation_id}, Prompt {prompt_id}: Claude API error for source '{item.source_text[:30]}...': {e}")
            task_has_errors = True
            model_output = f"ERROR: {e}"

        # 4. Store the result with prompt_id
        result_data = EvaluationResultCreate(
            evaluation_id=evaluation_id,
            prompt_id=prompt_id, # Store which prompt generated this
            source_text=item.source_text,
            model_output=model_output,
            reference_text=item.reference_text
        )
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
):
    """Initiate an evaluation run for multiple prompts."""
    # 1. Validate all prompt IDs exist
    prompt_ids = eval_request.prompt_ids
    found_prompts_count = await db[PROMPT_COLLECTION].count_documents({"_id": {"$in": prompt_ids}})
    if found_prompts_count != len(prompt_ids):
        # Find which prompts are missing (more complex query) or just raise generic error
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more specified prompt IDs were not found.",
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
    }
    insert_result = await db[EVAL_COLLECTION].insert_one(eval_data_dict)
    created_eval_id = insert_result.inserted_id

    # 3. Schedule background task for EACH prompt
    for prompt_id in prompt_ids:
        background_tasks.add_task(run_single_prompt_evaluation_task, created_eval_id, prompt_id, db)
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
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Checks if completed_tasks matches total_tasks and updates status."""
    eval_record = await db[EVAL_COLLECTION].find_one({"_id": evaluation_id})
    if not eval_record:
        raise HTTPException(status_code=404, detail=f"Evaluation {evaluation_id} not found")

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
                     eval_record = await db[EVAL_COLLECTION].find_one({"_id": evaluation_id})

            except ValueError as e:
                 logger.error(f"!!! CAUGHT ValueError during find_one_and_update for eval completion ({evaluation_id}) !!!")
                 logger.exception("ValueError details:")
                 raise HTTPException(status_code=500, detail="Internal error updating evaluation status (ValueError).")
            except Exception as e:
                 logger.error(f"!!! CAUGHT unexpected Exception during find_one_and_update for eval completion ({evaluation_id}) !!!")
                 logger.exception("Unexpected Exception details:")
                 raise HTTPException(status_code=500, detail="Internal error updating evaluation status (Exception).")

    if not eval_record:
         raise HTTPException(status_code=404, detail=f"Evaluation {evaluation_id} not found after update check")

    return Evaluation(**eval_record)

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
):
    """Retrieve all evaluation sessions from the database."""
    evals_cursor = db[EVAL_COLLECTION].find().sort("created_at", -1).skip(skip).limit(limit)
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
):
    """Retrieve a single evaluation session by its ID."""
    evaluation = await db[EVAL_COLLECTION].find_one({"_id": evaluation_id})
    if evaluation:
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
):
    """Retrieve all results for a given evaluation ID."""
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
):
    """Update the score or comment for a specific evaluation result."""
    update_data = result_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No score or comment data provided"
        )

    update_result = await db[RESULTS_COLLECTION].update_one(
        {"_id": result_id},
        {"set": update_data}
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