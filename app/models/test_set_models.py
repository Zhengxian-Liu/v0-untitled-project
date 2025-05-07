from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class ColumnMappingModel(BaseModel):
    sourceTextColumn: Optional[str] = None
    referenceTextColumn: Optional[str] = None
    textIdColumn: Optional[str] = None
    extraInfoColumn: Optional[str] = None

class UserTestSetBase(BaseModel):
    test_set_name: str
    language_code: str
    original_file_name: str
    file_type: str
    mappings_used: ColumnMappingModel
    row_count: int
    user_id: str # This will come from auth

class UserTestSetCreate(UserTestSetBase):
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)

class UserTestSetInDB(UserTestSetCreate):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)

    class Config:
        from_attributes = True # For Pydantic v2, was orm_mode
        populate_by_name = True # Allows using field name or alias
        json_encoders = {uuid.UUID: str} # Ensure UUID is serialized to str

class TestSetEntryBase(BaseModel):
    test_set_id: uuid.UUID
    row_number_in_file: Optional[int] = None # Optional, for reference
    source_text: str
    reference_text: Optional[str] = None
    text_id_value: Optional[str] = None
    extra_info_value: Optional[str] = None

class TestSetEntryCreate(TestSetEntryBase):
    pass

class TestSetEntryInDB(TestSetEntryCreate):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)

    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {uuid.UUID: str}

class TestSetUploadResponse(BaseModel):
    message: str
    test_set_id: uuid.UUID
    test_set_name: str 