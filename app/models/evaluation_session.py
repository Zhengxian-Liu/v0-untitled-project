from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

# Assuming PyObjectId helper is in common
from .common import PyObjectId

# --- Sub-models for Session Data --- M

class EvaluationSessionConfigColumn(BaseModel):
    """Configuration for a single column used in the saved session."""
    basePromptId: Optional[PyObjectId] = None # Link to the base prompt
    selectedVersionId: Optional[PyObjectId] = None # Link to the specific prompt version used
    modelId: Optional[str] = None # ID of the AI model used (if tracking)
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, PyObjectId: str}
    )

class EvaluationSessionTestItem(BaseModel):
    """A single item (source/reference) from the test set used."""
    sourceText: str
    referenceText: Optional[str] = None

class EvaluationSessionConfig(BaseModel):
    """Configuration details of the saved evaluation session."""
    columns: List[EvaluationSessionConfigColumn] = Field(default_factory=list)
    testSet: List[EvaluationSessionTestItem] = Field(default_factory=list)
    project: Optional[str] = None
    language: Optional[str] = None
    # Add other config like showIdealOutputs if needed
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, PyObjectId: str}
    )

class EvaluationSessionResult(BaseModel):
    """A single result row within the saved session."""
    promptId: Optional[PyObjectId] = None # Which prompt version generated this
    sourceText: str
    referenceText: Optional[str] = None
    modelOutput: Optional[str] = None
    score: Optional[int] = None
    comment: Optional[str] = None
    # --- Add LLM Judge Fields --- M
    llm_judge_score: Optional[float] = None
    llm_judge_rationale: Optional[str] = None
    llm_judge_model_id: Optional[str] = None
    # --- End Add --- M
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, PyObjectId: str}
    )

# --- Main Evaluation Session Model --- M

class EvaluationSessionBase(BaseModel):
    """Base attributes for a saved evaluation session."""
    # evaluationRunId: Optional[PyObjectId] = Field(None, description="Link to the original run ID, if applicable")
    # Let's make config and results required for a saved session
    config: EvaluationSessionConfig
    results: List[EvaluationSessionResult]
    # Maybe add a user-provided name/description for the saved session?
    session_name: str = Field(default="Saved Evaluation Session", max_length=150)
    session_description: Optional[str] = Field(None, max_length=500)
    saved_at: datetime = Field(default_factory=datetime.utcnow)
    user_id: PyObjectId # ADDED: Reference to the user who saved it

class EvaluationSessionInDB(EvaluationSessionBase):
    """Model representing a saved evaluation session in MongoDB."""
    id: PyObjectId = Field(default_factory=PyObjectId, validation_alias="_id")

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, PyObjectId: str},
    )

class EvaluationSession(EvaluationSessionInDB):
    """Properties to return to the client via API after saving."""
    # Exclude large fields from default response?
    # For now, return everything.
    pass

# --- NEW: Summary Model for List View --- M
class EvaluationSessionSummary(BaseModel):
    """Summary information for listing saved sessions."""
    # Include fields needed for the list view
    id: PyObjectId = Field(validation_alias="_id") # Need ID for linking
    session_name: str
    session_description: Optional[str] = None
    saved_at: datetime
    # Optionally include key config items if useful for list
    # project: Optional[str] = None # Need to extract from nested config
    # language: Optional[str] = None # Need to extract from nested config

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, PyObjectId: str},
    )
# --- End NEW Model ---

# --- Model for Create Request --- M
# This mirrors the structure sent by the frontend's handleSaveEvaluation
class EvaluationSessionCreate(BaseModel):
    evaluationRunId: Optional[PyObjectId] = None # Allow linking to original run
    config: EvaluationSessionConfig
    results: List[EvaluationSessionResult]
    session_name: Optional[str] = Field(None, max_length=150)
    session_description: Optional[str] = Field(None, max_length=500) 