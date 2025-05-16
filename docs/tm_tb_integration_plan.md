# TM/TB Service Integration Plan

Version: 1.3
Date: 2024-05-18

## 1. Introduction and Goal

The goal of this feature is to integrate an internal TM/TB (Translation Memory / Terminology Base) matching service into the existing prompt evaluation workflow. Before sending a source text segment to the LLM for translation, the system will first query the TM/TB service. The matches returned (if any) will be appended to the LLM prompt to provide additional context, potentially improving translation quality, consistency, and reducing LLM processing costs.

This document outlines the plan for implementing this integration.

## 2. TM/TB API Client (`app/services/tm_tb_client.py`)

A Python client (`tm_tb_client.py`) has been developed to interact with the TM/TB API (`localization/internalapi/at/resource/match`).

**Key Features:**
- Handles request signing (MD5 hash of secret + timestamp).
- Constructs the JSON payload for the API.
- Makes HTTP POST requests (currently synchronous using `requests`).
- Parses API responses and handles errors (network, API-specific).
- Provides a `match_resources` method to fetch TM/TB matches.

**Configuration:**
- The client (`TMTBClient`) is initialized with:
    - `base_url`: The TM/TB API endpoint URL.
    - `secret_key`: The secret key for authentication.
    - `default_project` (optional): A default project identifier.
    - `request_timeout` (optional): Timeout for API calls.
- These configuration values (especially `base_url` and `secret_key`) will be loaded from `.env` files using `os.getenv()`.

**Modifications Needed:**
- Ensure `text_id` and `project` parameters in `match_resources` are strictly required (defaults removed). Previously, only `text_id` modification was listed, but `project` was also made mandatory in the client.
- The client is instantiated within the evaluation task logic in `app/routes/evaluations.py`.
- Debug logging for request URL, headers, and payload has been added to aid troubleshooting.

## 3. Project and Language Code Consistency

**Key Principle**: The system now aims to use API-compliant, uppercase language IDs (e.g., "EN", "JA", "CHT") and API-compliant project IDs (e.g., "hk4e", "rpg") as early as possible, starting from the frontend and user setup.

### Project ID Mapping
Internal project names are mapped to API Project IDs. Frontend components and new prompt data should use the API Project IDs directly.
| User-Facing Name | API Project ID |
|-----------------|---------------|
| 原神            | hk4e          |
| 崩坏：星穹铁道  | rpg           |
| 绝区零          | blhz          |
| 未定事件簿      | nxx           |
| 崩坏3           | bh3           |

### Source Language
- Always use `"CHS"` (Simplified Chinese) for `srcLang` in TM/TB API calls.

### Target Language Handling
- **Frontend**: UI components responsible for language selection (e.g., `app/register/page.tsx`, `components/prompt-editor.tsx`, `components/prompt-library.tsx`) have been updated. Their `availableLanguages` lists now define language IDs in uppercase (e.g., `{ id: "EN", name: "英语" }`, `{ id: "CHT", name: "繁中" }`).
- **User Language**: The user's workspace language (`user.language`), when retrieved in `components/main-layout.tsx`, is converted to uppercase (e.g., `user?.language?.toUpperCase() ?? "EN"`) and passed down as `currentLanguage`. This ensures that prompts created in the editor inherit an uppercase language ID.
- **API Call**: The `tarLang` parameter for the TM/TB API call in `app/routes/evaluations.py` uses `prompt_model.language` (which is expected to be uppercase due to the above) or defaults to "EN".

## 4. Integration into Evaluation Workflow (`app/routes/evaluations.py`)

The core integration will occur within the `run_single_prompt_evaluation_task` asynchronous function in `app/routes/evaluations.py`.

**Initialization (at task start):**
1.  **Environment Variables**: `TM_TB_API_URL`, `TM_TB_API_SECRET`, and `TM_TB_DEFAULT_PROJECT` are loaded from the environment (e.g., `.env` file via `python-dotenv`).
2.  **Client Instantiation**: An instance of `TMTBClient` is created using these environment variables. If essential variables are missing, TM/TB processing is skipped with a log warning.

**Steps for each test item in `test_set_data` (within the loop):**

1.  **Parameter Generation for TM/TB API Call:**
    *   `dataId`: A randomly generated UUID string.
    *   `textId`: Same as `dataId` (random UUID string).
    *   `project`: Resolved with safeguards. It first uses `prompt_model.project`. If this is a known legacy ID ("genshin", "honkai", "zenless"), it's mapped to its API-compliant counterpart ("hk4e", "rpg", "blhz"). Otherwise, the value from `prompt_model.project` is used directly (assuming it's already API-compliant). This result is then prioritized over `TM_TB_DEFAULT_PROJECT` (from environment variables), with a final fallback to `"hk4e"`.
    *   `srcText`: From `item.source_text` of the current test set item.
    *   `srcLang`: Always `"CHS"`.
    *   `tarLang`: From `prompt_model.language` (expected to be uppercase, e.g., "EN", "JA", "CHT"). Defaults to "EN" if `prompt_model.language` is not set.
    *   `tmAssetIds`/`tbAssetIds`: Passed as an empty list `[]`.

2.  **Calling the TM/TB Service:**
    *   The `tm_tb_client.match_resources()` method will be called with the parameters above.
    *   A `try-except` block will handle potential `TMTBServiceError` (and its subclasses) from the client. If an error occurs, a log message will be recorded, and default empty values will be used for TM/TB strings.

3.  **Processing and Formatting TM/TB Results:**
    *   The API response is a list of match objects. Each object has a `type` field (either `"tm"` or `"tb"`), `srcLangContent`, `destLangContent`, and `matchRate` (for TM).
    *   **TM Matches (`type: "tm"`):**
        *   Will be formatted into a single string.
        *   Format per match: `Source: [srcLangContent], Target: [destLangContent], Match: [matchRate]%`
        *   Multiple TM matches will be joined by `; `.
        *   Inserted into `{SIMILAR_TRANSLATIONS}` in the LLM prompt.
    *   **TB Matches (`type: "tb"`):**
        *   Will be formatted into a single string.
        *   Format per match: `Term: [srcLangContent], Target: [destLangContent]`
        *   Multiple TB matches will be joined by `; `.
        *   Inserted into `{TERMINOLOGY}` in the LLM prompt.

4.  **Updating the LLM User Prompt:**
    *   The `user_prompt` (derived from `TASK_INFO_TEMPLATE` in `app/core/prompt_templates.py`) will be updated:
        *   The `{TERMINOLOGY}` placeholder will be replaced with the formatted TB string (or `[]` if no TB matches / errors).
        *   The `{SIMILAR_TRANSLATIONS}` placeholder will be replaced with the formatted TM string (or `[]` if no TM matches / errors).

5.  **Data/Text IDs:**
    *   Both `dataId` and `textId` will be generated as random UUID strings for each segment.

## 5. Mapping Utility

- While initially planned, a separate backend mapping utility for project/language IDs for TM/TB calls was not explicitly created. Instead:
    - Frontend components now use correct uppercase/API-compliant IDs.
    - `main-layout.tsx` ensures the passed `currentLanguage` is uppercase.
    - `evaluations.py` contains a small inline mapping for legacy project IDs as a safeguard.
This approach may be revisited if more complex mapping needs arise.

## 6. Thoroughness Requirement

- Frontend components (`prompt-editor.tsx`, `prompt-library.tsx`, `register/page.tsx`, `main-layout.tsx`) have been reviewed and updated to handle/propagate uppercase language IDs and API-compliant project IDs.
- Backend (`evaluations.py`) relies on corrected frontend data but includes temporary safeguards for legacy project IDs.
- Database migration for existing prompts (to update `language` to uppercase and `project` to API IDs) is recommended for full consistency.

## 7. Configuration Summary

-   **TM/TB API Client:**
    -   `TM_TB_API_URL`: Environment variable for the API base URL.
    -   `TM_TB_API_SECRET`: Environment variable for the API secret key.
    -   `TM_TB_DEFAULT_PROJECT`: Environment variable for the default project ID (e.g., "hk4e").
-   **Application:**
    -   `python-dotenv` should be used to load these variables from a `.env` file.

## 8. Error Handling

-   **TM/TB Client Errors:** The `TMTBClient` has built-in error handling for API and network issues, raising `TMTBServiceError` or its subclasses.
-   **Integration Point Errors:** In `run_single_prompt_evaluation_task`, calls to the TM/TB client will be wrapped in a `try-except` block.
    -   If an error occurs during the TM/TB call, it will be logged.
    -   The process will continue with empty TM/TB information (e.g., `[]`) being inserted into the prompt, ensuring the LLM call can still proceed.
    -   This prevents failures in the TM/TB service from halting the entire evaluation.

## 9. Testing and Confirmation

- **Successful API Calls**: Testing confirmed that the application successfully calls the TM/TB API.
- **Match Retrieval**: The system correctly retrieves TM and TB matches from the API when they exist.
- **Prompt Population**: Retrieved TM/TB matches are correctly formatted and appended/inserted into the appropriate placeholders (`{TERMINOLOGY}` and `{SIMILAR_TRANSLATIONS}`) in the LLM prompt.
- **Project ID Handling**: Legacy project IDs (e.g., "genshin" from older prompts) are correctly mapped to their API counterparts (e.g., "hk4e") for the TM/TB API call due to backend safeguards. New prompts use API-compliant IDs.
- **Language ID Handling**: User workspace language is correctly uppercased, and new prompts are saved with uppercase language IDs (e.g., "EN", "CHT"). This uppercase ID is used for the `tarLang` parameter in the TM/TB API call.

## 10. Future Considerations (Optional)

-   **Centralize `availableLanguages`**: The `availableLanguages` array is currently duplicated in several frontend components. Centralizing it in a shared constant file would improve maintainability.
-   **Refine Configuration**: Move TM/TB client configurations from direct `os.getenv()` calls in route files to a Pydantic `Settings` model for better management.
-   **Remove Legacy Safeguards**: Once data migration is complete and all systems consistently use new API/uppercase IDs, the backend safeguards for legacy project IDs and forceful uppercasing of language could be phased out.

This plan will guide the implementation of the TM/TB service integration. 