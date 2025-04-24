from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

# --- MODIFIED: Import from common --- M
from .common import PyObjectId
# --- End MODIFICATION ---

# Re-define PromptSection here for self-containment or import from prompt model
class PromptSection(BaseModel):
    id: str
    type: str
    name: str
    content: str

# --- Prompt History Model --- M

class PromptHistoryBase(BaseModel):
    """Base attributes for a historical prompt version."""
    # Fields copied from the Prompt state at the time of saving
    name: str
    description: Optional[str]
    sections: List[PromptSection]
    tags: List[str]
    project: Optional[str]
    language: Optional[str]
    isProduction: bool
    version: str # Store the version string it had at that time

class PromptHistoryInDB(PromptHistoryBase):
    """Model representing a historical prompt version in MongoDB."""
    id: PyObjectId = Field(
        default_factory=PyObjectId,
        validation_alias="_id" # Use _id only for input validation
    )
    prompt_id: PyObjectId = Field(..., description="ID of the main prompt this is a history for.")
    saved_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            PyObjectId: str
        },
    )

class PromptHistory(PromptHistoryInDB):
    """Properties to return to client via API for history list."""
    pass 