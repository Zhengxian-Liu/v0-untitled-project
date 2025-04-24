import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from typing import List
from bson import ObjectId
from datetime import datetime
import anthropic # For specific APIError handling

from app.db.client import get_database
from app.models.prompt import Prompt, PyObjectId
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

# --- Background Task --- M

async def run_evaluation_task(
    evaluation_id: PyObjectId,
    db: AsyncIOMotorDatabase
):
    """Background task to perform the actual evaluation against Claude API."""
    logger.info(f"Starting background evaluation task for ID: {evaluation_id}")
    eval_collection = db[EVAL_COLLECTION]
    results_collection = db[RESULTS_COLLECTION]
    prompt_collection = db[PROMPT_COLLECTION]

    # 1. Fetch the full evaluation record (including test data)
    eval_record_dict = await eval_collection.find_one({"_id": evaluation_id})
    if not eval_record_dict:
        logger.error(f"Background task failed: Evaluation record {evaluation_id} not found.")
        return
    # Use EvaluationInDB to parse the full record
    try:
        eval_record = EvaluationInDB(**eval_record_dict)
    except Exception as e:
        logger.error(f"Background task failed: Could not parse evaluation record {evaluation_id}. Error: {e}")
        # Optionally update status to failed
        await eval_collection.update_one(
            {"_id": evaluation_id}, {"$set": {"status": "failed", "completed_at": datetime.utcnow()}}
        )
        return

    # 2. Fetch the prompt text
    prompt_record = await prompt_collection.find_one({"_id": eval_record.prompt_id})
    if not prompt_record:
        logger.error(f"Background task failed: Prompt {eval_record.prompt_id} not found for evaluation {evaluation_id}.")
        await eval_collection.update_one(
            {"_id": evaluation_id}, {"$set": {"status": "failed", "completed_at": datetime.utcnow()}}
        )
        return
    prompt_text = prompt_record.get("text", "") # Assuming prompt model has 'text' field

    # 3. Update status to running
    await eval_collection.update_one(
        {"_id": evaluation_id}, {"$set": {"status": "running"}}
    )

    # 4. Iterate and call Claude API
    has_errors = False
    for item in eval_record.test_set_data:
        model_output = None
        try:
            # Note: This call is synchronous within the async task.
            # For many items, consider asyncio.gather with async client or thread pool executor.
            model_output = await generate_text_with_claude(prompt_text, item.source_text)
            logger.debug(f"Generated output for source: '{item.source_text[:30]}...' in eval {evaluation_id}")

        except ValueError as e:
            # Handle client initialization error from service
            logger.error(f"Claude client error during eval {evaluation_id}: {e}")
            has_errors = True
            # Optionally break or continue processing other items
            break # Stop processing if client isn't working
        except anthropic.APIError as e:
            logger.error(f"Claude API error for source '{item.source_text[:30]}...' in eval {evaluation_id}: {e}")
            has_errors = True
            model_output = f"ERROR: {e}" # Store error message as output
        except Exception as e:
            logger.error(f"Unexpected error for source '{item.source_text[:30]}...' in eval {evaluation_id}: {e}")
            has_errors = True
            model_output = f"UNEXPECTED ERROR: {e}"

        # 5. Store the result
        result_data = EvaluationResultCreate(
            evaluation_id=evaluation_id,
            source_text=item.source_text,
            model_output=model_output,
            reference_text=item.reference_text
        )
        await results_collection.insert_one(result_data.model_dump(exclude={"score", "comment"})) # Don't insert null score/comment initially

    # 6. Update final status
    final_status = "failed" if has_errors else "completed"
    await eval_collection.update_one(
        {"_id": evaluation_id},
        {"set": {"status": final_status, "completed_at": datetime.utcnow()}}
    )
    logger.info(f"Background evaluation task for ID: {evaluation_id} finished with status: {final_status}")

# --- API Endpoints --- M

@router.post(
    "/",
    response_model=Evaluation,
    status_code=status.HTTP_202_ACCEPTED, # Accepted for background processing
    summary="Start a new evaluation session",
    description="Accepts evaluation details and schedules it for background processing.",
)
async def create_evaluation(
    eval_request: EvaluationCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Initiate an evaluation run. Calls Claude API in the background."""
    # 1. Check if prompt exists
    prompt = await db[PROMPT_COLLECTION].find_one({"_id": eval_request.prompt_id})
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt with ID {eval_request.prompt_id} not found",
        )

    # 2. Create the main Evaluation record
    eval_data_dict = {
        "prompt_id": eval_request.prompt_id,
        "test_set_name": eval_request.test_set_name,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "test_set_data": [item.model_dump() for item in eval_request.test_set_data]
    }
    insert_result = await db[EVAL_COLLECTION].insert_one(eval_data_dict)
    created_eval_id = insert_result.inserted_id

    # 3. Schedule the background task
    background_tasks.add_task(run_evaluation_task, created_eval_id, db)
    logger.info(f"Scheduled background evaluation task for ID: {created_eval_id}")

    # 4. Return the created Evaluation record (without test_set_data)
    # Fetch the newly created record to return it structured by the model
    created_eval_record = await db[EVAL_COLLECTION].find_one({"_id": created_eval_id})
    if created_eval_record:
        # Use the Evaluation model (which excludes test_set_data by default)
        return Evaluation(**created_eval_record)
    else:
        # Should not happen
        raise HTTPException(status_code=500, detail="Failed to retrieve evaluation record after creation.")


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
    results = await results_cursor.to_list(length=None) # Get all results for this eval
    return [EvaluationResult(**res) for res in results]


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