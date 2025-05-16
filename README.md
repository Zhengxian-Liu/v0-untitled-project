# PromptCraft API & UI

This repository contains the backend API (FastAPI) and frontend UI (Next.js) for the PromptCraft application. PromptCraft is an internal tool designed for localization translators and language leads to efficiently create, test, evaluate, iterate, and manage AI prompts for machine translation, aiming to improve translation quality, consistency, and efficiency. [cite: 1]

## Current Status

The application provides a functional core loop for managing prompt versions, running evaluations against AI models (currently integrated with Anthropic's Claude), and saving/reviewing evaluation sessions. User authentication is in place, and data is generally scoped by the user's primary language. Test set management includes uploading custom test sets and using them in evaluations.

* **Architecture**: Fully containerized using Docker Compose (Nginx, Next.js Frontend, FastAPI Backend, MongoDB).
* **Authentication**: Username/password registration and JWT token login are implemented. User language context is established and used for data scoping.
* **Prompt Management**: Unified versioning is implemented, where each save of a prompt creates a new, distinct version document. APIs support creating the first version, saving subsequent new versions, reading the latest versions (for the library view), reading specific versions, listing all versions of a base prompt, and soft-deleting versions.
* **Evaluation Workflow**:
    * Users can select multiple prompt versions for evaluation.
    * Test data can be input manually or by selecting a previously uploaded user test set.
    * Evaluations run as background tasks on the backend, calling an external AI model (Anthropic Claude).
    * Results are polled by the frontend and displayed side-by-side.
    * Manual scoring and commenting on results are supported and persisted.
    * Evaluation sessions (configuration, test data, and results) can be saved and reviewed.
    * LLM-as-Judge: Evaluations can be submitted for automated scoring by an LLM (Claude Sonnet by default), which provides a score and rationale for each translation.
* **Test Set Management**: Users can upload CSV or Excel files as test sets, map columns (source text, reference text, etc.), and save them for reuse. These test sets are scoped by user and language.

## Key Features Implemented (Aligning with PRD)

This list reflects features from the Product Requirements Document (`PromptCraft.md`) that are substantially implemented in the current codebase:

* **User Authentication & Roles (Partial FR-UM-01, FR-UM-02)**:
    * User registration with username, password, and language.
    * Login with JWT token generation.
    * `get_current_active_user` dependency for protecting routes.
    * (Admin role and specific admin functionalities like managing system-wide standard test sets or system tags are not fully implemented yet).
* **Prompt Editor Module (PE)**:
    * **FR-PE-01 (Create Prompt - Initial Version)**: Implemented via `POST /api/v1/prompts/`.
    * **FR-PE-02 (Edit Prompt - Saves as New Version)**: Implemented via `PUT /api/v1/prompts/{version_id}` which creates a new version.
    * **FR-PE-03 (Prompt Text Editor - Basic Sections UI)**: Frontend `PromptEditor` component allows managing content in sections. Backend stores these sections. (Advanced variable highlighting and style guide integration might be partial).
    * **FR-PE-05 (Versioning - History/View/Restore as Unified Versions)**:
        * Each save creates a new version.
        * `GET /api/v1/prompts/base/{base_prompt_id}/versions` allows viewing all versions of a prompt.
        * Frontend `PromptEditor` has a version dropdown to load and view different versions.
        * "Restore" is achieved by viewing an old version and saving it, which creates a new version based on the old one's content.
    * **FR-PE-06 (Prompt Library View - Latest Versions)**: Implemented via `GET /api/v1/prompts/` (fetches latest versions) and `GET /api/v1/prompts/base-summaries/` (fetches base prompt groups). The frontend `PromptLibrary` component displays these.
* **Evaluation Module (EV)**:
    * **FR-EV-01 (Select Prompt(s) for Evaluation)**: Frontend `EvaluationPanel` allows selecting multiple prompt versions for columns. Backend accepts a list of `prompt_ids`.
    * **FR-EV-03 (Test Set Management - User Upload & Selection)**:
        * User upload of CSV/Excel implemented (`POST /api/v1/test-sets/upload`).
        * Frontend modal for file upload and column mapping.
        * Listing and selection of user's previously uploaded test sets (`GET /api/v1/test-sets/mine` and `GET /api/v1/test-sets/{id}/entries`).
        * Manual input of test rows is also supported in the `EvaluationPanel`.
    * **FR-EV-04 (Execute Evaluation)**: Implemented. Backend runs evaluations as background tasks. Frontend polls for completion.
    * **FR-EV-05 (Results Display)**: Frontend `EvaluationPanel` displays results in a table, side-by-side for different prompts.
    * **FR-EV-06 (Manual Scoring & Feedback)**: Implemented. Scores and comments can be added to results in the `EvaluationPanel` and are saved to the backend (`PUT /api/v1/evaluations/results/{result_id}`).
    * **FR-EV-07 (Save Evaluation Session)**: Implemented via `POST /api/v1/evaluation-sessions/`. Frontend has a "Save Evaluation" button.
    * **FR-EV-09 (Evaluation Result Summary/History - Listing & Viewing)**:
        * Listing saved sessions: `GET /api/v1/evaluation-sessions/`. Frontend `SavedSessionsList` component.
        * Viewing a specific saved session: `GET /api/v1/evaluation-sessions/{session_id}`. Frontend `ViewSessionDetailsModal`.
* **LLM-as-Judge (Related to FR-EV-09 conceptual goal)**:
    * `POST /api/v1/evaluations/{evaluation_id}/judge` triggers LLM-based scoring of results.
    * Results are updated with `llm_judge_score` and `llm_judge_rationale`.

## Architecture Overview

* **Frontend**: Next.js (React) with TypeScript, Shadcn UI, Tailwind CSS.
* **Backend**: FastAPI (Python) with Pydantic, Motor (async MongoDB driver).
* **Database**: MongoDB.
* **Orchestration**: Docker Compose (Nginx, Frontend, Backend, Database).
* **Reverse Proxy**: Nginx (handles routing between frontend and backend via `/api/v1/` prefix for backend).
* **Authentication**: JWT Tokens (via `python-jose` on backend, `localStorage` on frontend).
* **Password Hashing**: Passlib (bcrypt).
* **External Model Integration**: Anthropic Claude API (via `anthropic` Python SDK).

## API Endpoint Overview

All endpoints are prefixed with `/api/v1`. Protection status is indicated.

* **Auth** (`app/routes/auth.py`)
    * `POST /auth/register`: Register new user. (Public)
    * `POST /auth/token`: Login (OAuth2PasswordRequestForm), get JWT. (Public)
    * `GET /auth/users/me`: Get current user details. (Protected)
* **Prompts** (`app/routes/prompts.py`)
    * `POST /prompts/`: Create first prompt version. (Protected)
    * `GET /prompts/`: List latest prompt versions for user's language. (Protected)
    * `GET /prompts/base-summaries/`: List summaries of all base prompts for user's language. (Protected)
    * `GET /prompts/{version_id}`: Get specific prompt version. (Protected, checks language)
    * `PUT /prompts/{version_id}`: Save new version based on an existing one. (Protected, checks language)
    * `DELETE /prompts/{prompt_id}`: Soft delete a prompt version. (Protected, checks language)
    * `GET /prompts/base/{base_prompt_id}/versions`: Get all versions for a base prompt. (Protected, checks language)
    * `GET /prompts/production/`: Get production prompt for project & language. (Protected, checks language)
* **Evaluations** (`app/routes/evaluations.py`)
    * `POST /evaluations/`: Start a new multi-prompt evaluation. (Protected)
    * `GET /evaluations/`: List evaluation sessions for the user. (Protected)
    * `GET /evaluations/{evaluation_id}`: Get details of an evaluation session. (Protected)
    * `GET /evaluations/{evaluation_id}/results`: Get all results for an evaluation. (Protected)
    * `PATCH /evaluations/{evaluation_id}/check_completion`: Check/update evaluation status to completed. (Protected)
    * `PUT /evaluations/results/{result_id}`: Update score/comment for an evaluation result. (Protected)
    * `POST /evaluations/{evaluation_id}/judge`: Start LLM Judging for an evaluation. (Protected)
* **Evaluation Sessions (Saved)** (`app/routes/evaluation_sessions.py`)
    * `POST /evaluation-sessions/`: Save an evaluation session. (Protected)
    * `GET /evaluation-sessions/`: List saved evaluation sessions for the user. (Protected)
    * `GET /evaluation-sessions/{session_id}`: Get details of a saved evaluation session. (Protected)
    * `DELETE /evaluation-sessions/{session_id}`: Delete a saved evaluation session. (Protected)
* **Test Sets** (`app/routes/test_sets.py`)
    * `POST /test-sets/upload`: Upload a new test set file (CSV/Excel). (Protected)
    * `GET /test-sets/mine`: List test sets uploaded by the current user for their language. (Protected)
    * `GET /test-sets/{test_set_id}/entries`: Get all entries for a specific uploaded test set. (Protected)
* **Prompt Configuration** (`app/routes/prompt_config.py`)
    * `GET /prompt-structure`: Get fixed backend prompt structure templates (output requirement, task info). (Public or Protected - check `get_current_active_user` dependency if added)

## Setup & Running (Docker Compose Recommended)

1.  **Prerequisites**: Docker and Docker Compose (v2 syntax) installed.
2.  **Clone**: `git clone <repository-url>` and `cd <repository-directory>`
3.  **Configure Environment**:
    * Copy `.env.example` to `.env`.
    * Generate a `SECRET_KEY` for JWT: e.g., `openssl rand -hex 32`, and add it to `.env`.
    * Add your `ANTHROPIC_API_KEY` to `.env`.
    * Ensure `MONGO_URL` in `.env` is set to `mongodb://database:27017/promptcraft_db` for Docker Compose networking.
    * Set `LOG_LEVEL` (e.g., `INFO` or `DEBUG`) in `.env`.
4.  **Build & Run**: In the project root, run:
    ```bash
    docker compose up --build -d
    ```
    * `-d` runs containers in the background.
    * `--build` rebuilds images if code/Dockerfiles changed.
5.  **Access**: Open your browser to `http://localhost` (Nginx handles routing to the frontend). The backend API will be accessible via Nginx at `http://localhost/api/v1/`.
6.  **API Docs (Swagger UI)**: Accessible at `http://localhost/api/v1/docs` (after routing through Nginx).
7.  **Stop**: `docker compose down` (add `-v` to remove volumes like `mongo_data` if you want a clean start next time).

## Project Structure
.
├── app/                  # Backend FastAPI application
│   ├── core/             # Core logic (config, security, prompt_templates, token_utils)
│   ├── db/               # Database client (MongoDB connection)
│   ├── models/           # Pydantic models (user, prompt, evaluation, etc.)
│   ├── routes/           # API endpoint routers (auth, prompts, evaluations, etc.)
│   ├── services/         # Business logic services (claude_service, judge_service, test_set_service)
│   ├── schemas/          # Pydantic schemas (currently for prompt_config response)
│   ├── login/            # Frontend login page (Next.js App Router)
│   ├── register/         # Frontend registration page (Next.js App Router)
│   ├── layout.tsx        # Frontend root layout (Next.js App Router)
│   ├── page.tsx          # Frontend root page (Next.js App Router)
│   └── globals.css       # Frontend global styles (Tailwind directives)
├── components/           # Frontend React components (UI, Layouts, Features)
│   ├── ui/               # Shadcn UI components
│   └── (feature components like prompt-editor.tsx, evaluation-panel.tsx etc.)
├── docs/                 # Project documentation (PRD, plans, etc.)
├── hooks/                # Frontend custom React hooks
├── lib/                  # Frontend library code (apiClient, authContext, utils, prompt-templates)
├── public/               # Frontend static assets (fonts)
├── styles/               # Frontend global styles (old, app/globals.css is primary for Tailwind)
├── .env.example          # Example environment variables
├── .env                  # Actual environment variables (GITIGNORED)
├── docker-compose.yml    # Docker Compose service definitions
├── Dockerfile            # Dockerfile for backend
├── Dockerfile.frontend   # Dockerfile for frontend
├── nginx.conf            # Nginx reverse proxy configuration
├── main.py               # Backend application entry point (FastAPI app)
├── next.config.mjs       # Next.js configuration
├── package.json          # Frontend Node.js dependencies & scripts
├── pnpm-lock.yaml        # Frontend exact dependencies
├── requirements.txt      # Backend Python dependencies
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration for frontend
└── types.tsx             # Frontend shared TypeScript types


## TODO / Next Steps (High-Level)

* **Project Housekeeping**:Perform a project housekeeping to ensure a clean code base WITHOUT breaking any feature. Also consolidate the docs into a more coherent adn comprehensive doc.

* **Complete Endpoint Protection**: Ensure all necessary backend endpoints are robustly protected with `Depends(get_current_active_user)`.
* **Refine Frontend Features from PRD**:
    * **Prompt Versioning UI**: Enhance UI in Prompt Editor to easily switch between and compare versions (diff highlighting - FR-EV-05.1).
    * **Refine Results Display and Analysis**: Improve the user expefiences of eval result panel with clearer prompt used and better UI. 
    * **Refine Saved Results** Improve the saved result panel to allow for a more comprehensive review of past evaluations.
* **Advanced Prompt Features**:
    * Prompt branching (FR-PE-05).
    * Refine XML tag experiences in prompt editor.
* **UI/UX Refinements**:
    * Improve user feedback beyond toasts (e.g., more contextual loading states, error displays).
    * Address any frontend hydration errors (e.g., theme-related).
    * Debouncing for text inputs that trigger API calls (e.g., evaluation result comments).
* **Testing**: Add comprehensive unit and integration tests for both backend and frontend.
* **Style Guide Integration**: Detailed feature doc to be added later. Ignore for now.

