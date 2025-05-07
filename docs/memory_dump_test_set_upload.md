# Memory Dump: User Test Set Upload Feature (FR-EV-03)

## Goal
Implement the functionality for users (e.g., Language Leads) to upload their own test sets (CSV/Excel) for evaluating prompts within the PromptCraft application. This includes uploading, parsing, mapping columns, saving, listing, selecting, and using the data in the evaluation panel.

## Frontend Implementation (`components/evaluation-panel.tsx`, `components/TestSetUploadForm.tsx`, `types.tsx`)

1.  **UI Flow**:
    *   Added a "Test Data Input" section to `EvaluationPanel`.
    *   Uses a modal (`Dialog` from shadcn/ui) triggered by an "Upload File" button for managing the upload process.
    *   Modal steps: File Selection -> Column Mapping -> Save.
    *   Added a `Select` dropdown in the main panel to list and select previously uploaded test sets.

2.  **File Handling**:
    *   `TestSetUploadForm` component handles the stylized button click -> hidden file input interaction. Accepts `.csv`, `.xlsx`.
    *   `EvaluationPanel` receives the selected `File` object.
    *   Client-side header parsing implemented using the `xlsx` (SheetJS) library within `EvaluationPanel` triggered after file selection. Loading state added.

3.  **Column Mapping & Naming**:
    *   Added state (`modalStep`, `columnMappings`, `testSetName`) in `EvaluationPanel`.
    *   When headers are parsed, the modal transitions to the mapping step (`modalStep='columnMapping'`).
    *   UI displays detected headers.
    *   Provides `Select` dropdowns for the user to map detected headers to standard fields (`sourceTextColumn`, `referenceTextColumn`, `textIdColumn`, `extraInfoColumn`). Source Text is mandatory. Optional fields have a "Not Applicable" option.
    *   Provides an `Input` for the user to name the test set (pre-filled from filename).
    *   "Save Test Set" button is enabled when name and source mapping are provided.

4.  **Saving & Listing**:
    *   `handleSaveTestSet` function:
        *   Constructs `FormData` containing the raw file, test set name, language code (from `currentLanguage` prop), and stringified column mappings.
        *   Calls the `POST /api/v1/test-sets/upload` backend endpoint using `apiClient`.
        *   On success, closes the modal and calls `fetchUserTestSets` to refresh the list.
    *   `fetchUserTestSets` function:
        *   Calls `GET /api/v1/test-sets/mine` on component mount and after successful upload.
        *   Populates `userTestSetsList` state used by the "Select Existing Test Set" dropdown.

5.  **Populating Evaluation Table**:
    *   `handleSelectUserTestSet` function:
        *   Triggered when selecting from the dropdown.
        *   Calls `GET /api/v1/test-sets/{test_set_id}/entries`.
        *   Transforms the fetched entries (backend `TestSetEntryBase[]`) into the frontend `TestRow[]` format needed by the table.
        *   Updates the `testRows` state, replacing manual rows and populating the evaluation table.
    *   `handleRunEvaluation` uses the `testRows` state (which reflects either manual data or data from a selected test set) as the source for evaluation requests.

6.  **Types (`types.tsx`)**:
    *   Added interfaces: `UploadedFileInfo`, `ColumnMapping`, `TestSetUploadPayload`, `TestSetUploadResponse`, `UserTestSetSummary`, `TestSetEntryBase`.

## Backend Implementation (`app/models`, `app/services`, `app/routes`, `main.py`, `requirements.txt`)

1.  **Dependencies**: Added `pandas`, `openpyxl` to `requirements.txt`. Ensured `xlsx` was *removed* (as it's frontend only).
2.  **Models (`app/models/test_set_models.py`)**:
    *   Defined Pydantic models: `ColumnMappingModel`, `UserTestSetBase`, `UserTestSetCreate`, `UserTestSetInDB`, `TestSetEntryBase`, `TestSetEntryCreate`, `TestSetEntryInDB`, `TestSetUploadResponse`, `UserTestSetSummary`.
    *   Configured models to handle MongoDB `_id` mapping using `validation_alias="_id"` and `populate_by_name=True`.
    *   Ensured `id` fields related to Test Sets use `uuid.UUID`.
    *   Configured JSON encoders for `UUID` and `datetime`.
3.  **Service (`app/services/test_set_service.py`)**:
    *   `process_and_save_test_set` function:
        *   Takes DB instance, file, form data (`test_set_name`, `language_code`, `mappings_json`, etc.), `user_id`.
        *   Parses `mappings_json`.
        *   Reads `.csv` or `.xlsx` file content into a pandas DataFrame.
        *   Validates required mapped columns exist in the DataFrame.
        *   Creates `UserTestSetInDB` model instance (generates UUID for `id`).
        *   **Crucially**: Creates `doc_to_insert` dictionary and explicitly sets `doc_to_insert['_id'] = new_test_set.id` to store the UUID as the primary key `_id` in MongoDB.
        *   Iterates through DataFrame, applies mappings to extract data, creates `TestSetEntryCreate` instances.
        *   Inserts the metadata document (`doc_to_insert`) into `user_test_sets` collection.
        *   Bulk inserts entry documents into `test_set_entries` collection.
4.  **Routes (`app/routes/test_sets.py`)**:
    *   Created `test_sets` router.
    *   `POST /upload`:
        *   Receives `multipart/form-data` (File, Form fields).
        *   Depends on auth (`get_current_active_user`).
        *   Calls `process_and_save_test_set` service.
        *   Returns `TestSetUploadResponse`.
    *   `GET /mine`:
        *   Depends on auth and DB (`get_database`).
        *   Queries `user_test_sets` collection based on `user_id` and `language_code`.
        *   Returns `List[UserTestSetSummary]`.
    *   `GET /{test_set_id}/entries`:
        *   Depends on auth and DB.
        *   Validates user ownership by querying `user_test_sets` for `_id` (UUID) and `user_id` (str).
        *   Queries `test_set_entries` collection by `test_set_id` (UUID).
        *   Returns `List[TestSetEntryBase]`.
5.  **Database Client (`app/db/client.py`)**:
    *   Configured `AsyncIOMotorClient` with `uuidRepresentation='standard'` to ensure correct storage and querying of UUIDs as BSON Binary subtype 0x04.
6.  **Main App (`main.py`)**:
    *   Included the `test_sets` router.
    *   Modified `lifespan` function to attach the DB instance to `app.db` for access via `request.app.db` (as currently used by `/upload`, while `/mine` and `/entries` use `Depends(get_database)`).
    *   Modified logging setup multiple times to debug level issues, ending with forcing root and 'app' loggers to INFO level as a workaround for an unidentified configuration override.

## Key Debugging & Resolutions
*   Corrected frontend API paths (removed duplicate `/api/v1`).
*   Fixed backend `ModuleNotFoundError` by correcting auth import path and adding `__init__.py` files.
*   Fixed backend `AttributeError` for `app.db` by setting `app.db` in `main.py`'s lifespan.
*   Fixed MongoDB connection errors (`Name or service not known`, `No space left on device`, container restarts) by correcting MongoDB service definition, clearing volume, and addressing resource issues.
*   Fixed UUID encoding/querying errors (`cannot encode native uuid.UUID`, `Metadata not found` despite matching string IDs) by:
    *   Setting `uuidRepresentation='standard'` on the Motor client.
    *   Ensuring the `_id` field in `user_test_sets` collection is explicitly set to the `uuid.UUID` from the Pydantic model during insertion.
*   Fixed Pydantic validation error (`id Field required`) for `UserTestSetSummary` by adding `validation_alias="_id"` to the `id` field.
*   Diagnosed and worked around logging level suppression issues. 