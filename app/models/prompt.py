from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

# --- MODIFIED: Import PyObjectId from common --- M
from .common import PyObjectId
# --- REMOVE Incorrect Import --- M
# from .prompt_history import PromptSection
# --- End REMOVE ---

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
    """Shared base attributes for a Prompt version."""
    name: str = Field(..., min_length=1, max_length=100, description="The name of the prompt.")
    description: Optional[str] = Field(None, max_length=500, description="An optional description for the prompt.")
    sections: List[PromptSection] = Field(default_factory=list, description="The structured sections of the prompt.")
    text: Optional[str] = Field(None, description="Optional: Assembled text content of the prompt.")
    tags: List[str] = Field(default_factory=list, description="Tags associated with the prompt.")
    project: Optional[str] = Field(None, description="Associated project identifier (e.g., 'genshin').")
    isProduction: bool = Field(default=False, description="Indicates if this version is the production one for its project/language.")
    version: str = Field(default="1.0", description="Version string for this specific prompt version.")
    # --- Versioning Fields --- M
    base_prompt_id: Optional[PyObjectId] = Field(None, description="Identifier linking versions of the same conceptual prompt.")
    is_latest: bool = Field(default=True, description="Indicates if this is the latest saved version of the prompt.")
    # --- End Versioning Fields ---
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    language: Optional[str] = Field(None, max_length=10, description="Associated language identifier (e.g., 'en').")

class PromptCreate(PromptBase):
    """Properties to receive via API on creation of the *first* version."""
    # On first creation, base_prompt_id and is_latest will be set by the backend logic.
    # Exclude them from the direct create payload schema.
    model_config = ConfigDict(
        # Pydantic v2 way to exclude fields from schema generation
        fields={
            'base_prompt_id': {'exclude': True},
            'is_latest': {'exclude': True}
        }
    )
    # version will also be defaulted to 1.0 by backend

class PromptUpdate(BaseModel):
    """Properties to receive via API when saving a *new* version based on an existing one."""
    # User provides the state they want for the NEW version.
    # Backend will handle base_prompt_id, version increment, is_latest flags.
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    sections: Optional[List[PromptSection]] = None
    text: Optional[str] = None
    tags: Optional[List[str]] = None
    project: Optional[str] = None
    isProduction: Optional[bool] = None
    # Version is handled automatically by backend, don't allow update here
    # version: Optional[str] = None

class PromptInDBBase(PromptBase):
    """Base model for Prompt version stored in MongoDB."""
    # Represents a specific version document
    id: PyObjectId = Field(
        default_factory=PyObjectId,
        validation_alias="_id"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    language: Optional[str] = Field(None, description="Associated language identifier (e.g., 'en').")

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={
            ObjectId: str,
            PyObjectId: str
        },
    )

class Prompt(PromptInDBBase):
    """Properties to return to client via API for a specific prompt version."""
    # Add the dynamically calculated latest score (optional)
    latest_score: Optional[float] = Field(None, description="The latest evaluation score for this specific prompt version (calculated on retrieval).")
    pass 