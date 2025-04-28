# PromptCraft Backend API

This repository contains the backend API and frontend UI for the PromptCraft application, designed to manage AI prompts, run evaluations, and integrate with various AI models for localization workflows.

## Current Status (as of Refactoring Breakpoint)

The application provides a functional core loop for managing prompt versions and running evaluations.

*   **Architecture:** Fully containerized using Docker Compose (Nginx, Next.js Frontend, FastAPI Backend, MongoDB).
*   **Authentication:** Basic username/password registration and JWT token login implemented. User language context is established.
*   **Prompt Management:** Unified versioning implemented (each save creates a new version document). API supports creating first version, saving new versions, reading latest versions (for library), and reading specific versions.
*   **Evaluation Panel:** UI allows selecting multiple prompt versions, adding test rows manually, running evaluations via backend background tasks, polling for results, displaying results side-by-side, basic scoring/commenting UI (persisted to backend), saving evaluation sessions, listing saved sessions, and viewing saved session details.

## Key Features Implemented (Aligning with PRD v1.0)

*   Basic user registration and login.
*   Language context tied to user.
*   Prompt creation (FR-PE-01 - Initial Version).
*   Prompt editing (FR-PE-02 - Saves as new version).
*   Basic prompt text editor (via Sections UI) (FR-PE-03 - partially).
*   Prompt versioning (FR-PE-05 - History/Restore implemented as unified versions).
*   Prompt library view (showing latest versions) (FR-PE-06 - latest only).
*   Multi-prompt selection for evaluation (FR-EV-01).
*   Manual test set input via table rows (FR-EV-03 - Manual Input part).
*   Evaluation execution via background tasks (FR-EV-04).
*   Side-by-side results display (FR-EV-05).
*   Manual scoring and commenting UI (FR-EV-06 - feedback saving implemented).
*   Saving evaluation sessions (FR-EV-07).
*   Listing/Viewing saved evaluation sessions.

## Architecture Overview

*   **Frontend:** Next.js (React) with TypeScript, Shadcn UI, Tailwind CSS.
*   **Backend:** FastAPI (Python) with Pydantic, Motor (async MongoDB driver).
*   **Database:** MongoDB.
*   **Orchestration:** Docker Compose.
*   **Reverse Proxy:** Nginx (handles routing between frontend and backend).
*   **Authentication:** JWT Tokens (via python-jose).
*   **Password Hashing:** Passlib (bcrypt).

## Setup & Running

1.  **Prerequisites:** Docker and Docker Compose (v2 syntax) installed.
2.  **Clone:** `git clone <repository-url>`
3.  **Configure Environment:**
    *   Copy `.env.example` to `.env`.
    *   Generate a `SECRET_KEY`: `openssl rand -hex 32` and add it to `.env`.
    *   Add your `ANTHROPIC_API_KEY` to `.env`.
    *   Ensure `MONGO_URL` is set to `mongodb://database:27017/promptcraft_db`.
4.  **Build & Run:** In the project root, run:
    ```bash
    docker compose up --build -d
    ```
    *   `-d` runs containers in the background.
    *   `--build` rebuilds images if code/Dockerfiles changed.
5.  **Access:** Open your browser to `http://localhost` (Nginx handles routing).
6.  **Stop:** `docker compose down`

## API Endpoint Overview (via Nginx at `http://localhost`)

*   `/api/v1/auth/register` (POST): Register new user.
*   `/api/v1/auth/token` (POST): Login (form data), get JWT.
*   `/api/v1/auth/users/me` (GET): Get current user details (Protected).
*   `/api/v1/prompts/` (POST): Create first prompt version (Protected).
*   `/api/v1/prompts/` (GET): List latest prompt versions (Protected).
*   `/api/v1/prompts/{version_id}` (GET): Get specific prompt version (Protection TODO).
*   `/api/v1/prompts/{version_id}` (PUT): Save new version based on existing (Protection TODO).
*   `/api/v1/prompts/base/{base_prompt_id}/versions` (GET): Get all versions for a base prompt (Protection TODO).
*   `/api/v1/prompts/production/` (GET): Get production prompt for project/language (Protection TODO).
*   `/api/v1/prompts/{version_id}` (DELETE): Delete specific prompt version (Protection TODO, Logic TODO).
*   `/api/v1/evaluations/` (POST): Start multi-prompt evaluation (Protection TODO).
*   `/api/v1/evaluations/{eval_id}/results` (GET): Get evaluation results (Protection TODO).
*   `/api/v1/evaluations/{eval_id}/check_completion` (PATCH): Check/update evaluation status (Protection TODO).
*   `/api/v1/evaluations/results/{result_id}` (PUT): Update score/comment (Protection TODO).
*   `/api/v1/evaluation-sessions/` (POST): Save evaluation session (Protection TODO).
*   `/api/v1/evaluation-sessions/` (GET): List saved evaluation sessions (Protection TODO).
*   `/api/v1/evaluation-sessions/{session_id}` (GET): Get saved session details (Protection TODO).

## TODO / Next Steps

*   **Protect All Endpoints:** Add `Depends(get_current_active_user)` to all relevant non-auth API endpoints.
*   **Evaluation Panel - Test Sets:** Implement Standardized Test Set selection and/or File Upload (FR-EV-03).
*   **Evaluation Panel - Export:** Implement "Export Results" button functionality (FR-EV-08).
*   **Evaluation Panel - Diff Highlighting:** Implement prompt difference highlighting (FR-EV-05.1).
*   **Prompt Editor - Tagging:** Add UI and backend logic for tagging prompts (FR-PE-04).
*   **Prompt Editor - Share as Example:** Implement FR-PE-09.
*   **Prompt Editor - Version Selection:** Add UI to view/select older versions of the current prompt using the `/base/{base_id}/versions` endpoint.
*   **Refine Delete Logic:** Determine and implement behavior for deleting prompt versions and saved sessions.
*   **Fix Hydration Error:** Investigate and fix the root cause of the theme-related hydration warning in the frontend.
*   **UI/UX Refinements:** Improve user feedback (beyond toasts), add more loading states, potentially add debouncing for comment saving.
*   **User Management UI:** Add frontend UI for user profile settings (e.g., password change).
*   **Model Selection:** Allow choosing different AI models for evaluation (FR-EV-02).
*   **Unit/Integration Tests:** Add tests.

## Project Structure

```
.
├── app/                  # Backend FastAPI application code
│   ├── core/             # Core backend (config, security)
│   ├── db/               # Database client
│   ├── models/           # Pydantic models (common, user, prompt, eval, session)
│   ├── routes/           # API routers (auth, prompts, eval, sessions)
│   └── services/         # Business logic (claude_service)
├── components/           # Frontend React components (UI, Layouts, Features)
├── lib/                  # Frontend library code (authContext, apiClient)
├── public/               # Frontend static assets (fonts)
├── styles/               # Frontend global styles
├── .env.example          # Example environment variables
├── .env                  # Actual environment variables (GITIGNORED)
├── .gitignore            # Git ignore rules
├── docker-compose.yml    # Docker Compose service definitions
├── Dockerfile            # Dockerfile for backend
├── Dockerfile.frontend   # Dockerfile for frontend
├── nginx.conf            # Nginx reverse proxy configuration
├── main.py               # Backend application entry point
├── next.config.mjs       # Next.js configuration
├── package.json          # Frontend Node.js dependencies
├── pnpm-lock.yaml        # Frontend exact dependencies
├── postcss.config.mjs    # PostCSS configuration
├── PromptCraft.md        # Original PRD
├── README.md             # This file
├── requirements.txt      # Backend Python dependencies
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── types.tsx             # Frontend shared TypeScript types
```

## TODO / Future Enhancements

*   **Protect All Endpoints:** Add `Depends(get_current_active_user)` to all relevant prompt, evaluation, and session endpoints to ensure proper authentication and authorization.
*   **Refine Delete Logic:** Determine and implement the desired behavior for deleting prompt versions (e.g., delete all in base, only non-latest, cascade deletes?).
*   **Evaluation Panel Features:** Implement remaining features like Test Set Upload/Standardized Sets, Export, Diff Highlighting, Model Selection.
*   **Prompt Editor Features:** Add Tagging, Share as Example, Branching.
*   **Fix Hydration Error:** Investigate and fix the root cause of the theme-related hydration warning in the frontend.
*   **UI/UX Refinements:** Improve user feedback, add loading states, potentially add debouncing for comment saving.
*   **Unit/Integration Tests:** Add comprehensive tests for backend and potentially frontend.
*   **User Management UI:** Add frontend UI for user profile settings (e.g., changing language, password).
*   **Workspace Context:** Replace simulated language context with a proper user/workspace system.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Create a virtual environment:** (Recommended)
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure environment variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file and provide your actual MongoDB connection string (`MONGO_URL`) and your Anthropic API key (`ANTHROPIC_API_KEY`).

## Running the Application (Development)

Use Uvicorn to run the FastAPI application:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

*   `--reload`: Enables auto-reloading when code changes (useful for development).
*   `--host`: The interface to bind to (127.0.0.1 for local access only).
*   `--port`: The port to listen on.

You can access the API documentation (Swagger UI) automatically generated by FastAPI at `http://127.0.0.1:8000/docs`.

## Running with Docker Compose (Recommended)

This method runs both the backend API and the MongoDB database in containers.

1.  **Ensure Docker and Docker Compose are installed.**

2.  **Configure Environment Variables:**
    *   Make sure you have a `.env` file (copy `.env.example` if needed).
    *   **Important:** When running with Docker Compose, the backend container needs to connect to the database container using its service name. Update the `MONGO_URL` in your `.env` file:
        ```env
        # Use the service name 'database' as the host
        MONGO_URL=mongodb://database:27017/promptcraft_db
        
        # Other variables (like ANTHROPIC_API_KEY) remain the same
        ANTHROPIC_API_KEY=your_anthropic_api_key_here
        LOG_LEVEL=INFO
        ```

3.  **Build and Run:**
    Open your terminal in the project root directory and run:
    ```bash
    docker-compose up --build
    ```
    *   `--build`: Forces Docker Compose to rebuild the backend image if the `Dockerfile` or application code has changed.
    *   The first time you run this, it will download the `python` and `mongo` images and build your backend image, which might take a few minutes.
    *   Subsequent runs will be much faster.

4.  **Accessing the Application:**
    *   The API will be available at `http://localhost:8000`.
    *   The API docs (Swagger UI) will be at `http://localhost:8000/docs`.
    *   The MongoDB database is accessible from your host machine at `mongodb://localhost:27017` if you need to connect directly using a tool like MongoDB Compass (useful for debugging).

5.  **Stopping the Application:**
    Press `Ctrl+C` in the terminal where `docker-compose up` is running. To remove the containers (but keep the `mongo_data` volume), you can run:
    ```bash
    docker-compose down
    ```

## Next Steps

This initial setup includes:
*   FastAPI application instance.
*   MongoDB connection management during application lifespan.
*   Configuration loading from `.env` file.
*   Basic logging setup.

Next, we will implement:
1.  Pydantic models for Prompts and Evaluations.
2.  API routes for Prompt CRUD operations.
3.  API routes and services for running Evaluations using the Claude API.