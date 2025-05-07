# app/routes/prompt_config.py
from fastapi import APIRouter, Depends
from app.core.prompt_templates import FIXED_OUTPUT_REQUIREMENT_TEMPLATE, TASK_INFO_TEMPLATE
# Assuming you create or have this schema file:
from ..schemas.prompt_config import PromptStructureResponse
# You might need authentication depending on your setup, import if necessary
# from app.services.auth import get_current_active_user 

router = APIRouter()

@router.get(
    "/prompt-structure", 
    response_model=PromptStructureResponse,
    summary="Get Fixed Prompt Structure Templates",
    description="Retrieve the fixed backend templates used for output requirements and task info structure.",
    # Add dependencies=[Depends(get_current_active_user)] if this endpoint requires login
)
async def get_prompt_structure():
    """
    Returns the content of the fixed backend prompt structure templates.
    These are used by the backend to assemble the final prompt sent to the LLM
    and by the frontend for preview purposes.
    """
    return PromptStructureResponse(
        output_requirement=FIXED_OUTPUT_REQUIREMENT_TEMPLATE,
        task_info=TASK_INFO_TEMPLATE,
        # character_info=CHARACTER_INFO_TEMPLATE, # Add when ready
    ) 