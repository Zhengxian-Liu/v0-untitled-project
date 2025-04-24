from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

# --- MODIFIED: Import PyObjectId from common --- M
from .common import PyObjectId
from .prompt_history import PromptSection # Import section from history or define here?
# Let's define PromptSection here as it's core to Prompt
# --- End MODIFICATION ---

# Define PromptSection structure here
class PromptSection(BaseModel):
    id: str
    type: str
    name: str
    content: str

# Helper Class for MongoDB ObjectId compatibility with Pydantic
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _validation_info=None): # Adjusted for Pydantic v2 compatibility
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    # For Pydantic V2, schema modification is handled differently, often via CoreSchema
    # This simple representation is often sufficient for basic JSON schema needs
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        # Reuse the validation logic within the CoreSchema definition
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(cls.validate)

    # How it should be represented in JSON Schema (e.g., for OpenAPI docs)
    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        json_schema = handler(core_schema)
        json_schema.update(type='string', example='5eb7cf5a86d9755df3a6c593')
        return json_schema

# --- Prompt Models ---

class PromptBase(BaseModel):
    """Shared base attributes for a Prompt."""
    name: str = Field(..., min_length=1, max_length=100, description="The name of the prompt.")
    description: Optional[str] = Field(None, max_length=500, description="An optional description for the prompt.")
    # --- Store sections, make text optional (could be derived/cached) --- M
    sections: List[PromptSection] = Field(default_factory=list, description="The structured sections of the prompt.")
    text: Optional[str] = Field(None, description="Optional: Assembled text content of the prompt.") # Make text optional
    # --- End section change ---
    tags: List[str] = Field(default_factory=list, description="Tags associated with the prompt.")
    project: Optional[str] = Field(None, description="Associated project identifier (e.g., 'genshin').")
    language: Optional[str] = Field(None, description="Associated language identifier (e.g., 'en').")
    isProduction: bool = Field(default=False, description="Indicates if this is the production prompt for its project/language.")
    version: str = Field(default="1.0", description="Version string for the prompt.")

class PromptCreate(PromptBase):
    """Properties to receive via API on creation."""
    # Remove text? Or expect client to send assembled text AND sections?
    # Let's expect sections primarily, text can be generated/ignored on create.
    text: Optional[str] = None

class PromptUpdate(BaseModel):
    """Properties to receive via API on update, all optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    sections: Optional[List[PromptSection]] = None # Allow updating sections
    text: Optional[str] = None # Allow updating assembled text if desired
    tags: Optional[List[str]] = None
    project: Optional[str] = None
    language: Optional[str] = None
    isProduction: Optional[bool] = None
    version: Optional[str] = None

class PromptInDBBase(PromptBase):
    """Base model for Prompt stored in MongoDB, includes DB-specific fields."""
    id: PyObjectId = Field(
        default_factory=PyObjectId,
        validation_alias="_id"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            PyObjectId: str
        },
    )

class Prompt(PromptInDBBase):
    """Properties to return to client via API."""
    pass 