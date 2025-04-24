from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

# Assuming PyObjectId helper is in common or defined elsewhere
# from .common import PyObjectId
# Re-define PyObjectId here if not in common.py yet
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _validation_info=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(cls.validate)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        json_schema = handler(core_schema)
        json_schema.update(type='string', example='5eb7cf5a86d9755df3a6c593')
        return json_schema

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