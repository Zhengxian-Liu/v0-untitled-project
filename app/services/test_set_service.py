import pandas as pd
from fastapi import HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
import json
import io # For reading UploadFile content into pandas
from typing import List, Dict, Any
import uuid

from app.models.test_set_models import (
    ColumnMappingModel,
    UserTestSetCreate,
    UserTestSetInDB,
    TestSetEntryCreate,
    TestSetEntryInDB
)

# Collection names
USER_TEST_SETS_COLLECTION = "user_test_sets"
TEST_SET_ENTRIES_COLLECTION = "test_set_entries"

async def process_and_save_test_set(
    db: AsyncIOMotorDatabase,
    file: UploadFile,
    test_set_name: str,
    language_code: str,
    mappings_json: str,
    original_file_name: str,
    file_type: str,
    user_id: str
) -> UserTestSetInDB:
    try:
        mappings_dict = json.loads(mappings_json)
        column_mappings = ColumnMappingModel(**mappings_dict)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mappings JSON format.")
    except Exception as e: # Pydantic validation error
        raise HTTPException(status_code=400, detail=f"Invalid column mapping data: {e}")

    file_content = await file.read()
    await file.close() # Ensure file is closed

    try:
        if file_type == 'text/csv':
            df = pd.read_csv(io.BytesIO(file_content))
        elif file_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']:
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_type}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file content: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or could not be parsed.")

    # Validate that mapped columns exist in the DataFrame
    required_source_col = column_mappings.sourceTextColumn
    if not required_source_col or required_source_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Mapped source text column '{required_source_col}' not found in uploaded file.")

    # Prepare test set metadata
    test_set_metadata = UserTestSetCreate(
        test_set_name=test_set_name,
        language_code=language_code,
        original_file_name=original_file_name,
        file_type=file_type,
        mappings_used=column_mappings,
        row_count=len(df),
        user_id=user_id
    )
    
    new_test_set = UserTestSetInDB(**test_set_metadata.model_dump())

    # Prepare document for insertion, ensuring _id is the UUID from the model's 'id' field
    doc_to_insert = new_test_set.model_dump(exclude_none=True) # Use exclude_none=True to not insert None fields
    doc_to_insert['_id'] = new_test_set.id # Explicitly set _id for MongoDB to be the UUID
    if 'id' in doc_to_insert and doc_to_insert['id'] == new_test_set.id:
        del doc_to_insert['id'] # Avoid inserting both 'id' and '_id' if they are the same UUID object

    # Prepare test set entries
    entries_to_insert = []
    for index, row in df.iterrows():
        source_text = str(row[required_source_col]) if required_source_col in row and pd.notna(row[required_source_col]) else ""
        
        reference_text = None
        if column_mappings.referenceTextColumn and column_mappings.referenceTextColumn in row and pd.notna(row[column_mappings.referenceTextColumn]):
            reference_text = str(row[column_mappings.referenceTextColumn])

        text_id_value = None
        if column_mappings.textIdColumn and column_mappings.textIdColumn in row and pd.notna(row[column_mappings.textIdColumn]):
            text_id_value = str(row[column_mappings.textIdColumn])
        
        extra_info_value = None
        if column_mappings.extraInfoColumn and column_mappings.extraInfoColumn in row and pd.notna(row[column_mappings.extraInfoColumn]):
            extra_info_value = str(row[column_mappings.extraInfoColumn])

        if not source_text: # Skip rows where essential source text is missing after mapping
            # Or, decide if this should be an error or just a skip
            # print(f"Skipping row {index+1} due to missing source text after mapping.")
            continue

        entry_data = TestSetEntryCreate(
            test_set_id=new_test_set.id,
            row_number_in_file=index + 1,
            source_text=source_text,
            reference_text=reference_text,
            text_id_value=text_id_value,
            extra_info_value=extra_info_value
        )
        entries_to_insert.append(entry_data.model_dump(exclude_none=True))
    
    if not entries_to_insert:
        # This could happen if all rows were skipped due to missing source_text after mapping
        # Or if the file was empty after the header row (if any)
        raise HTTPException(status_code=400, detail="No valid entries could be processed from the file based on mappings.")

    try:
        await db[USER_TEST_SETS_COLLECTION].insert_one(doc_to_insert)
        
        if entries_to_insert:
            await db[TEST_SET_ENTRIES_COLLECTION].insert_many(entries_to_insert)
            
        return new_test_set
    except Exception as e:
        # TODO: Add cleanup logic here if metadata was inserted but entries failed?
        # For now, simple re-raise.
        raise HTTPException(status_code=500, detail=f"Database error: {e}") 