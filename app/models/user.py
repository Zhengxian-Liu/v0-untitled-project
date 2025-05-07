from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime
from bson import ObjectId

from .common import PyObjectId # Import common ObjectId handler

# --- User Models --- M

class UserBase(BaseModel):
    """Base user attributes."""
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_]+$", description="Unique username (alphanumeric and underscore only)")
    language: str = Field(..., description="Primary language workspace for the user (e.g., 'en', 'ja')")
    # Add other non-sensitive fields if needed later (e.g., full_name)
    # email: Optional[EmailStr] = None
    # full_name: Optional[str] = None
    disabled: Optional[bool] = False

class UserCreate(UserBase):
    """Properties received via API on user creation."""
    password: str = Field(..., min_length=8, description="User password (will be hashed)")

class UserUpdate(BaseModel):
    """Properties allowed for updating a user (example)."""
    language: Optional[str] = None
    disabled: Optional[bool] = None
    # Add others as needed, but password update should be separate endpoint

class UserInDBBase(UserBase):
    """Base model for User stored in DB, includes hashed password."""
    id: PyObjectId = Field(default_factory=PyObjectId, validation_alias="_id")
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True, # Allow reading 'id' or '_id'
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, PyObjectId: str}
    )

# Separate model for DB representation
class UserInDB(UserInDBBase):
    pass

class User(UserBase):
    """Properties to return via API (excludes password)."""
    id: PyObjectId # Include ID in response
    # Exclude disabled status by default? Or keep it?
    # disabled: Optional[bool] = None

    model_config = ConfigDict(
        # Ensure this also works with validation_alias for ID input
        # if we ever fetch User and need to map _id -> id here too
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, PyObjectId: str}
    ) 