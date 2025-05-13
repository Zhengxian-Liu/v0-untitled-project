# PromptCraft: Current Codebase Memory Dump

## Overall Goal
PromptCraft is an internal tool designed for localization translators and language leads to create, test, evaluate, iterate, and manage AI prompts for machine translation, aiming to improve translation quality, consistency, and efficiency.

## Current Status (Backend Focus)

The backend is a FastAPI application with MongoDB as the database. It provides APIs for:

### 1. User Authentication & Management
*   Registration (`/register`) with username, password (hashed using bcrypt), and primary language.
*   Login (`/token`) using OAuth2PasswordRequestForm, returning a JWT access token.
*   Fetching current user details (`/users/me`).
*   Dependencies (`get_current_active_user`) to protect routes and provide user context.
*   User language is a key aspect, with data generally scoped by the user's language.

### 2. Prompt Management (Unified Versioning)
*   Each save of a prompt creates a *new version document* in the `prompts` collection.
*   **Key fields per version:** `_id` (unique version ID), `base_prompt_id` (links versions of the same conceptual prompt), `version` (e.g., "1.0", "2.0"), `is_latest` (boolean), `name`, `description`, `sections` (structured content), `text` (assembled content), `tags`, `project`, `language`, `isProduction` (boolean, unique per project/language), `created_at`, `updated_at`, `is_deleted`, `deleted_at`.
*   **APIs:**
    *   `POST /prompts/`: Create the *first version* (e.g., "1.0") of a prompt. `base_prompt_id` is set to the new version's `_id`. Language is taken from the user.
    *   `GET /prompts/`: List *latest versions* of prompts for the user's language.
    *   `GET /prompts/{version_id}`: Get a specific prompt version.
    *   `PUT /prompts/{version_id}` (`save_new_version_from_existing`): Save a *new version* based on an existing one. It finds the current latest for the `base_prompt_id`, increments the version, sets the new one to `is_latest=True`, and updates the previous latest to `is_latest=False`.
    *   `DELETE /prompts/{prompt_id}`: Soft delete (sets `is_deleted=True`, `deleted_at`, `is_latest=False`).
    *   `GET /prompts/base/{base_prompt_id}/versions`: Get all non-deleted versions for a base prompt.
    *   `GET /prompts/production/`: Get the prompt marked `isProduction=True` for a specific project and language.
*   Language scoping is enforced: users can only interact with prompts matching their language.
*   The `_ensure_unique_production_prompt` helper ensures only one prompt version is marked `isProduction` for a given project/language.

### 3. Evaluation Management
*   Allows evaluating multiple prompt versions against a test set.
*   **APIs & Process:**
    *   `POST /evaluations/`: Start a multi-prompt evaluation.
        *   Takes `prompt_ids` (list of prompt version IDs) and `test_set_data` (list of source texts, optional references, etc.).
        *   Validates that all prompt IDs exist and belong to the user's language.
        *   Creates an `Evaluation` record in MongoDB (status "pending", then "running"). Key fields: `prompt_ids`, `test_set_name`, `status`, `user_id`, `test_set_data` (copied), `total_prompt_tasks`, `completed_prompt_tasks`.
        *   Schedules background tasks (`run_single_prompt_evaluation_task`) for *each* prompt ID.
    *   `run_single_prompt_evaluation_task` (background task):
        *   Assembles a system prompt from the prompt's sections and a user prompt from the test item (including context like previous/next sentences).
        *   Calls `claude_service.generate_text_with_claude` for each item in `test_set_data`.
        *   Extracts translated text from `<translated_text>` tags in the model output.
        *   Creates `EvaluationResult` documents in MongoDB. Key fields: `evaluation_id`, `prompt_id` (specific version), `source_text`, `model_output`, `reference_text`, `sent_system_prompt`, `sent_user_prompt`, `prompt_token_count`.
        *   Increments `completed_prompt_tasks` in the parent `Evaluation` record.
    *   `GET /evaluations/{evaluation_id}/results`: Get all `EvaluationResult` rows for an evaluation.
    *   `PUT /evaluations/results/{result_id}`: Update score/comment for a specific `EvaluationResult`.
    *   `PATCH /evaluations/{evaluation_id}/check_completion`: Endpoint to check if all sub-tasks are done and update the `Evaluation` status to "completed".
    *   `GET /evaluations/`: List evaluation sessions for the current user.
    *   `GET /evaluations/{evaluation_id}`: Get details of a specific evaluation.
*   Authorization checks ensure users can only access their own evaluations.

### 4. LLM-as-Judge Evaluation
*   `POST /evaluations/{evaluation_id}/judge`: Triggers a background task (`run_llm_judging_task`) to evaluate all results of a completed evaluation using an LLM judge.
*   `run_llm_judging_task` (background task):
    *   Iterates through `EvaluationResult` documents for the given `evaluation_id`.
    *   Calls `judge_service.evaluate_translation` for each result.
    *   `judge_service.evaluate_translation`:
        *   Formats a prompt for the judge LLM (default `claude-3-5-sonnet-20240620`) including source, model output, and optional reference.
        *   Requests JSON output with `score` (1-5) and `rationale`.
        *   Parses the JSON from the judge's response.
        *   Updates the `EvaluationResult` document with `llm_judge_score`, `llm_judge_rationale`, `llm_judge_model_id`.
    *   Updates the parent `Evaluation` record's `judge_status` (e.g., "pending", "completed", "failed").

### 5. Evaluation Session Saving & Loading
*   Allows users to save a snapshot of an evaluation (configuration, test items, results including scores/comments).
*   **APIs:**
    *   `POST /evaluation-sessions/`: Save an evaluation session. Takes config, results, and an optional name/description. Stores `user_id`.
    *   `GET /evaluation-sessions/`: List saved sessions (summary view) for the current user.
    *   `GET /evaluation-sessions/{session_id}`: Get full details of a specific saved session.
    *   `DELETE /evaluation-sessions/{session_id}`: Delete a saved session.
*   Authorization checks ensure users can only access/delete their own saved sessions.

### 6. User Test Set Upload (FR-EV-03)
*   `POST /api/v1/test-sets/upload` (router mounted at `/api/v1/test-sets`):
    *   Handles `multipart/form-data` (file, test set name, language code, column mappings JSON).
    *   Uses `test_set_service.process_and_save_test_set`.
    *   Service reads CSV/Excel using pandas, applies mappings.
    *   Creates `UserTestSetInDB` (metadata, `_id` is UUID) and `TestSetEntryInDB` (individual rows, also UUID `id`s) documents.
*   `GET /api/v1/test-sets/mine`: Lists test sets uploaded by the user.
*   `GET /api/v1/test-sets/{test_set_id}/entries`: Gets entries for a specific test set, validating user ownership.
*   Database client is configured with `uuidRepresentation='standard'`.
*   Models (`test_set_models.py`) use `uuid.UUID` and are configured for MongoDB `_id` mapping.

## Dependencies & Configuration

*   **Key Python Libraries:** FastAPI, Uvicorn, Motor (async MongoDB), Pydantic, Anthropic SDK, Passlib (bcrypt), python-jose (JWT), Pandas, Openpyxl.
*   Configuration is managed via `.env` files (e.g., `SECRET_KEY`, `ANTHROPIC_API_KEY`, `MONGO_URL`).
*   `app/core/config.py` likely uses Pydantic's `BaseSettings`.
*   `app/db/client.py` handles MongoDB connection with retry logic and sets `uuidRepresentation='standard'`.
*   Custom JSON encoders for `ObjectId` and `PyObjectId` are registered in `main.py`.

## Services

*   `claude_service.py`: Interacts with Anthropic's Claude models.
*   `judge_service.py`: Uses `claude_service` for LLM-based translation evaluation. Includes prompt templating for the judge and JSON parsing of the output.
*   `test_set_service.py`: Processes uploaded test files (CSV/Excel) using Pandas, applies column mappings, and saves data to MongoDB.

## Data Models (`app/models/`)

*   Well-defined Pydantic models for all major entities: `User`, `Token`, `Prompt` (and `PromptSection`), `Evaluation` (and `EvaluationResult`, `EvaluationCreateRequest`), `EvaluationSession`, and `TestSet` models (`UserTestSetBase`, `TestSetEntryBase`, etc.).
*   `PyObjectId` handles MongoDB `ObjectId` mapping.
*   Prompt versioning fields (`base_prompt_id`, `is_latest`, `version`) are central to `Prompt` models.
*   Test set models use `uuid.UUID` for IDs.

## Noteworthy from Markdown Documents

*   **`PromptCraft.md` (PRD):** Outlines extensive features, including UI for prompt editing, version control (history, branching), test set management (upload, standard sets, manual input), multi-prompt evaluation, result display with diffing, scoring, session saving, and more. The backend seems to be implementing many of these core features.
*   **`memory_dump_test_set_upload.md`:** Details the implementation of the user test set upload feature (FR-EV-03), aligning well with the observed backend code in `app/routes/test_sets.py`, `app/services/test_set_service.py`, and `app/models/test_set_models.py`.
*   **`IMPLEMENTATION_PLAN.md`:** Describes a refactoring for "Unified Prompt Versioning," where each prompt save creates a distinct version document. This is consistent with the `prompts.py` route logic (create, save new version, read latest/specific).
*   **`README.md`:** Provides an overview. The "Current Status" and "Key Features Implemented" sections generally align with the backend code read so far, particularly regarding unified prompt versioning and evaluation capabilities. It also mentions a Next.js frontend and Docker setup.

## Points for Further Investigation (Frontend & Deployment)

*   The structure and content of frontend components (`components/`, `lib/`, `app/[locale]/` etc.) to understand UI implementation.
*   `docker-compose.yml` and `Dockerfile`(s) for backend and frontend to understand the containerized setup and build process.
*   `nginx.conf` for how requests are routed between frontend and backend.
*   The `src/` directory and its `features/` subdirectory.
*   The unusual Next.js-like files directly within the `app/` backend directory (`layout.tsx`, `page.tsx`, `globals.css`).

This summary captures the core backend architecture and functionality based on the files reviewed. The system is built around robust versioned prompt management and a flexible evaluation pipeline, including automated LLM-based judging and user-uploaded test sets. 