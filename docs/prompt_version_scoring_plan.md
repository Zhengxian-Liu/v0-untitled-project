# Implementation Plan: Prompt Version Score Display (On-the-Fly Calculation)

## 1. Feature Overview

This document outlines the plan to implement the feature of displaying the latest evaluation score for each specific version of a prompt within the Prompt Library view, **calculating the score dynamically when the prompt list is requested**.

**User Workflow:**

1.  User creates/edits a prompt (implicitly creating/updating a version).
2.  User selects one or more prompt versions for evaluation using a test set.
3.  User runs the evaluation and assigns scores to the outputs for each prompt version (as per FR-EV-06).
4.  User saves the evaluation session/results (as per FR-EV-07). **The score is stored only within the evaluation results.**
5.  When browsing the Prompt Library (FR-PE-06), the user requests the list of prompts. The backend dynamically determines and includes the latest score for each version before sending the list to the frontend.

## 2. Data Model Modifications

Leveraging the existing structure in `types.tsx`, the following are relevant:

*   **`Prompt` Object (Represents a Prompt Version)**:
    *   `id: string` (Version ID - **Exists**)
    *   `base_prompt_id: string` (Links versions - **Exists**)
    *   `is_latest: boolean` (Flags latest version of the base prompt - **Exists**)
    *   `version?: string` (Display name for version - **Exists**)
    *   **(NO CHANGE NEEDED HERE)**: The `Prompt` object/type itself does not need a dedicated `score` field.

*   **`EvaluationResult` Object**:
    *   `prompt_id: string` (Links to the specific `Prompt` version ID - **Exists**)
    *   `score: number | null` (Score given during evaluation - **Exists**)
    *   `created_at: string` (Timestamp for when the result was created/saved - **Exists, crucial for finding the 'latest'**)

*   **Conceptual "Base Prompt" / Grouping**:
    *   The backend logic and frontend UI will still need to group `Prompt` objects by their `base_prompt_id`.

## 3. Backend API Changes

*   **Evaluation Saving Endpoint** (e.g., `POST /evaluations` or similar):
    *   **(NO CHANGE NEEDED for score propagation)**: This endpoint simply saves the evaluation results (including `prompt_id`, `score`, and timestamp) as usual. It does *not* need to update the `Prompt` object itself.
*   **Prompt Listing Endpoint** (e.g., `GET /prompts`):
    *   **Modify**: This endpoint's logic needs significant changes.
        1.  Fetch the list of `Prompt` versions based on the request criteria.
        2.  For each `Prompt` version (`prompt_id`) in the list, query the `EvaluationResult` data (or equivalent table/collection) to find the most recent entry matching that `prompt_id` which has a non-null `score`.
        3.  Retrieve the `score` from that latest evaluation result.
        4.  **Dynamically add** a `latest_score: number | null` field to the prompt version data being sent back to the frontend. If no score is found, this field should be `null`.
    *   **Optimization**: This query needs to be efficient. Avoid N+1 query patterns. Use database features like joins, subqueries, window functions, or optimized lookups depending on the database technology.

## 4. Frontend (UI/UX) Changes

*   **Prompt Library View (FR-PE-06)**:
    *   **Modify**: Update the component responsible for rendering the list of prompts.
    *   **Consume Score**: Expect a `latest_score` field (potentially nullable) on each prompt version object received from the `GET /prompts` endpoint.
    *   **Display Score**: For each prompt version shown, display its `latest_score` value.
        *   Format appropriately (e.g., "Score: 4.5/5", "Latest Score: 3", or just the number).
        *   Handle cases where `latest_score` is `null` (e.g., display "Not Evaluated", "N/A", or nothing).
    *   **Version Display**: Ensure the UI clearly distinguishes between different versions (using `base_prompt_id`, `version`, `created_at`).
*   **Evaluation Result Saving**:
    *   Ensure the frontend correctly sends the `prompt_id` (version ID) and assigned `score` when saving evaluation results. (No change needed specifically for this plan, but ensure it's correct).

## 5. Database Schema Changes

*   **(NO CHANGES NEEDED)** to the `prompts` (or `prompt_versions`) table for storing scores.
*   Ensure the `evaluation_results` table has appropriate indexes (e.g., on `prompt_id` and the timestamp/creation date column) to support efficient lookup of the latest score.

## 6. Migration Plan

*   **(NO MIGRATION NEEDED)** related to adding score fields to prompts.

## 7. Open Questions/Considerations

*   **Performance**: The primary concern is the performance of the `GET /prompts` endpoint, especially with many prompts and evaluation results. Database query optimization is crucial. Caching strategies might be considered if performance becomes an issue.
*   **Score Calculation**: If an evaluation session results in an *average* score for a prompt version over a test set, ensure the "latest" lookup correctly identifies and uses the score from the most recent *session* or *run* that reported a score for that version. The definition of "latest" needs to be clear (e.g., latest evaluation result timestamp).
*   **UI for Versions**: Decide on the best UI pattern in the library to show multiple versions and their scores.
*   **Score Context**: Displaying just the score might lack context. This is inherent in the requirement, but linking to the evaluation could be a future step. 