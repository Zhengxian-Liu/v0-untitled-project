# PromptCraft Implementation Plan

This document tracks the implementation progress and plan for the PromptCraft backend and frontend.

## Current Phase: Refactoring for Unified Prompt Versioning

**Goal:** Modify the data storage and API to treat each prompt save as a distinct version document, allowing users to evaluate different versions of the same conceptual prompt. This replaces the previous "latest version + history snapshots" model.

**Strategy:** Unified Version Collection (Each document in `prompts` collection is a specific version).

---

### Chunk 1: Backend - Modify Data Models (DONE)

*   **Status:** Pending
*   **Goal:** Update Pydantic models (`prompt.py`) to reflect the new structure. Remove the now-redundant history model.
*   **Tasks:**
    *   \[ ] Modify `app/models/prompt.py` (`PromptBase`, `PromptInDBBase`, `Prompt`):
        *   Add `base_prompt_id: PyObjectId`. (Initially same as `id` for first version).
        *   Add `is_latest: bool = Field(default=True)`.
        *   Ensure `version` field exists.
    *   \[ ] Delete `app/models/prompt_history.py`.
    *   \[ ] Ensure `app/models/common.py` contains `PyObjectId` and imports are correct.
*   **Relevant PRD:** FR-PE-05 (Versioning)

---

### Chunk 2: Backend - Adapt Core Prompt Routes (Create, Read Latest, Read Specific)

*   **Status:** Pending
*   **Goal:** Modify main API routes for creating and reading versioned prompts.
*   **Tasks:**
    *   \[ ] Modify `app/routes/prompts.py`:
        *   **`create_prompt` (POST /):**
            *   Generate `id` (version ID).
            *   Set `base_prompt_id` (e.g., same as `id`).
            *   Set `version = "1.0"`.
            *   Set `is_latest = True`.
            *   Save new document.
        *   **`read_prompts` (GET /):** (Library View)
            *   Filter MongoDB query by `is_latest=True`.
        *   **`read_prompt` (GET /{version_id}):** (Get Specific Version)
            *   Rename path parameter from `prompt_id` to `version_id`.
            *   Fetch specific document by `_id == version_id`.
        *   **Remove History Endpoint:** Delete `GET /{prompt_id}/history`.
*   **Relevant PRD:** FR-PE-05, FR-PE-01, FR-PE-06

---

### Chunk 3: Backend - Implement "Save New Version" Logic (Handling Update)

*   **Status:** Pending
*   **Goal:** Refactor the update logic so "Save" always creates a new version document based on the edited one.
*   **Tasks:**
    *   \[ ] Modify `app/routes/prompts.py`:
        *   **`update_prompt` (PUT /{version_id}):**
            *   Rename function conceptually (e.g., `save_new_version_from_existing`).
            *   Parameter `version_id` identifies the base document being edited.
            *   Fetch the document corresponding to `version_id` to get `base_prompt_id`.
            *   Find the *current latest* document for that `base_prompt_id`.
            *   Increment version number based on the current latest.
            *   Create *new* document with new `_id`, request payload data, incremented version, `base_prompt_id`, `is_latest=True`.
            *   Update *previous latest* document: set `is_latest = False`.
            *   Save the *new* document.
            *   Handle `isProduction` uniqueness check (update `_ensure_unique_production_prompt` if needed).
            *   Return the *new* document.
        *   **Remove Restore Endpoint:** Delete `POST /{prompt_id}/restore/{history_id}`.
*   **Relevant PRD:** FR-PE-02, FR-PE-05

---

### Chunk 4: Frontend - Adapt UI and API Calls

*   **Status:** Pending
*   **Goal:** Update frontend components to work with the new versioned API.
*   **Tasks:**
    *   \[ ] Update `types.tsx`: Add `base_prompt_id`, `is_latest` to `Prompt` type. Remove `PromptHistory`.
    *   \[ ] Update `components/prompt-library.tsx`:
        *   Fetch latest versions (`GET /prompts/`).
        *   `onPromptSelect` passes the specific `id` (version ID) of the selected row.
    *   \[ ] Update `components/main-layout.tsx`:
        *   `selectedPrompt` holds a specific version object.
    *   \[ ] Update `components/prompt-editor.tsx`:
        *   Receives specific version object via `prompt` prop.
        *   `handleSave` function:
            *   Performs `PUT /api/v1/prompts/{prompt.id}` (sending the ID of the version being edited).
        *   Remove "View History" button/dialog/state.
        *   (Future): Add UI to list/select other versions using `base_prompt_id`.
    *   \[ ] Update `components/evaluation-panel.tsx`:
        *   Prompt selection dropdowns fetch *latest* versions (`GET /prompts/`). Store the `id` (version ID) of the selected prompt.
*   **Relevant PRD:** FR-PE-05, FR-PE-06

---