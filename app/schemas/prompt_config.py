# app/schemas/prompt_config.py
from pydantic import BaseModel, Field

class PromptStructureResponse(BaseModel):
    """Defines the structure for the response of the /prompt-structure endpoint."""
    output_requirement: str = Field(..., description="Template defining the required output format from the LLM.")
    task_info: str = Field(..., description="Template defining the structure for runtime task info.")
    # Add character_info later if needed
    # character_info: str | None = Field(None, description="Template defining the structure for character info, if available.") 