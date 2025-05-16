# **PromptCraft \- Product Requirements Document (PRD)**

Version: 2.0  
Date: May 16, 2025  
Author: \[Your Name/Team\]

## **1\. Introduction**

### **1.1 Purpose**

PromptCraft is an internal tool designed for localization translators and language leads to efficiently create, test, evaluate, iterate, and manage AI prompts for machine translation. The primary aim is to improve translation quality, consistency, and efficiency by providing a robust and user-friendly platform for prompt engineering.

### **1.2 Document Overview**

This document outlines the product requirements for PromptCraft Version 2.0. It builds upon the existing functionality and incorporates planned enhancements and features identified in the project's README.md. It details the goals, target users, functional requirements, non-functional requirements, and future considerations for the application.

## **2\. Goals and Objectives**

* **Improve Translation Quality:** Enable users to craft and refine prompts that produce more accurate, contextually appropriate, and stylistically consistent AI translations.  
* **Increase Efficiency:** Streamline the workflow for prompt creation, testing, and iteration, reducing the time and effort required by localization teams.  
* **Enhance Consistency:** Facilitate the use of standardized and optimized prompts across different projects and languages.  
* **Foster Collaboration & Knowledge Sharing:** (Future Goal) Create a platform where effective prompts and evaluation insights can be shared within and across language teams.  
* **Data-Driven Optimization:** Provide tools for evaluating prompt performance quantitatively (scores) and qualitatively (comments, LLM rationale) to make informed decisions.  
* **Standardize Prompt Engineering Workflow:** Offer a unified and structured approach to managing the lifecycle of AI prompts.

## **3\. Target Users**

* **Primary Users:**  
  * Localization Translators  
  * Language Leads  
* **Secondary Users:**  
  * Localization/Efficiency Teams  
  * Project Managers involved in localization  
  * AI/MT Specialists

## **4\. Overall Design Principles**

* **Iterative Workflow:** The system must support a seamless "Edit \-\> Test \-\> Evaluate \-\> Iterate" cycle for prompt development.  
* **User-Centricity:** The UI/UX should be intuitive, minimizing friction and providing clear feedback to the user.  
* **Language-Specific Context:** Operations and data should be primarily scoped by the user's designated language workspace.  
* **Modularity & Scalability:** The architecture should allow for future expansion of features, integration with new AI models, and handling of increasing data volumes.  
* **Data Integrity & Security:** Robust authentication, authorization, and data protection mechanisms are paramount.

## **5\. Functional Requirements (FR)**

This section details the functional requirements, categorized by module. "Status" indicates if the feature is largely existing or planned for future development based on the README.md.

### **5.1 User Management & Authentication (UM)**

| ID | Requirement | Priority | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| FR-UM-01 | User Registration & Login | Critical | Existing | Username, password (hashed), and primary language selection during registration. JWT token-based login. |
| FR-UM-02 | Language Context | Critical | Existing | User operations and data visibility scoped by their registered primary language. |
| FR-UM-03 | Role-Based Access Control (RBAC) | High | Partial | Basic user role exists. Future: Distinct Admin role with specific privileges (e.g., managing system-wide test sets, user management). |
| FR-UM-04 | User Profile Management | Medium | Future | Allow users to change their password. Potentially update language preference (if business logic allows). |
| FR-UM-05 | Secure Endpoints | Critical | Ongoing | All relevant backend endpoints must be protected, requiring authentication and authorization (Depends(get\_current\_active\_user)). |

### **5.2 Prompt Management (PM)**

| ID | Requirement | Priority | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| FR-PM-01 | Create New Prompts | Critical | Existing | Create the first version of a prompt, including name, description, and structured sections. |
| FR-PM-02 | Edit Prompts (Section-Based) | Critical | Existing | Edit prompt details and content within a structured section-based UI (e.g., role, instructions, context, custom sections). Editor should support basic text operations. |
| FR-PM-03 | Unified Prompt Versioning | Critical | Existing | Every save of a prompt creates a new, distinct version document. Versions are linked by a base\_prompt\_id. |
| FR-PM-04 | View and Load Prompt Versions | Critical | Existing | Users can view the version history of a prompt (based on base\_prompt\_id) and load any specific version into the editor. "Restore" is achieved by loading an old version and saving it (which creates a new version). |
| FR-PM-05 | Prompt Library | Critical | Existing | Display a list of prompts (latest versions or base prompt summaries). Support search by name/description and filtering by project and language. |
| FR-PM-06 | Soft Delete Prompts | High | Existing | Ability to mark prompt versions as "deleted" (soft delete) so they are hidden from active views but potentially recoverable. |
| FR-PM-07 | Mark Prompt as "Production" | High | Existing | Allow a specific prompt version to be flagged as the "production" version for a given project and language combination. Ensure uniqueness of this flag per project/language. |
| FR-PM-08 | Prompt Branching | Medium | Future | Allow users to create a "branch" from an existing prompt version to experiment with significant modifications without altering the main line of versions. Branches would have their own version history. |
| FR-PM-09 | Enhanced Prompt Editor Experience | Medium | Future | Improve editor usability, potentially including syntax highlighting for variables/placeholders, better handling/validation of XML-like tags used in prompts, and integration with style guide snippets/variables. |
| FR-PM-10 | Prompt Templates & Reusable Snippets | Medium | Future | Allow creation, management, and insertion of predefined prompt templates and reusable text snippets/sections to accelerate prompt creation. (Partially exists with fixed backend templates, needs user-managed capabilities). |
| FR-PM-11 | Tagging System for Prompts | Medium | Future | Allow users to add/remove descriptive tags to prompts for better organization and filtering. |

### **5.3 Test Set Management (TSM)**

| ID | Requirement | Priority | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| FR-TSM-01 | Upload Custom Test Sets | Critical | Existing | Users can upload test set files (CSV, Excel). |
| FR-TSM-02 | Column Mapping for Uploaded Test Sets | Critical | Existing | During upload, users can map columns from their file to standard fields (e.g., Source Text, Reference Text, Text ID, Extra Info). |
| FR-TSM-03 | List and Select User-Uploaded Test Sets | Critical | Existing | Users can view a list of their previously uploaded test sets (scoped by their language) and select one to populate the evaluation panel. |
| FR-TSM-04 | Manual Test Data Entry | High | Existing | Users can manually add/edit/delete rows of test data (source text, reference text, additional instructions) directly in the evaluation panel. |
| FR-TSM-05 | Standardized Test Sets | Medium | Future | Admins can upload and manage system-wide standardized test sets. Users can select these for evaluation. |
| FR-TSM-06 | Test Set Versioning/Management | Low | Future | More advanced management features for test sets (e.g., versioning, editing uploaded sets, sharing). |

### **5.4 Evaluation Workflow (EW)**

| ID | Requirement | Priority | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| FR-EW-01 | Select Multiple Prompts for Evaluation | Critical | Existing | Users can configure multiple columns in the evaluation panel, each with a selected prompt version, to compare outputs side-by-side. |
| FR-EW-02 | Execute Evaluation | Critical | Existing | Trigger evaluation runs against the selected AI model (currently Anthropic Claude). Backend processes these as background tasks. Integration with existing localization pipelines (TM/TB lookup) for prompt enrichment before LLM call. |
| FR-EW-03 | Real-time Polling & Status Updates | Critical | Existing | Frontend polls the backend for evaluation status (pending, running, completed, failed) and updates the UI accordingly. |
| FR-EW-04 | Side-by-Side Results Display | Critical | Existing | Evaluation results (source, reference, AI outputs for each selected prompt) are displayed in a tabular format for easy comparison. Option to show/hide sent prompts and token counts. |
| FR-EW-05 | Manual Scoring & Commenting | Critical | Existing | Users can assign a numerical score (e.g., 1-5) and add textual comments to each AI-generated output. This feedback is persisted. |
| FR-EW-06 | LLM-as-Judge Automated Scoring | High | Existing | Users can trigger an LLM (e.g., Claude Sonnet) to automatically score evaluation results, providing a numerical score and a textual rationale. These are displayed alongside manual scores. |
| FR-EW-07 | Save Evaluation Sessions | High | Existing | Users can save the entire state of an evaluation (configuration of prompts/models, test data used, all results including manual and LLM scores/comments) for later review. |
| FR-EW-08 | List and View Saved Evaluation Sessions | High | Existing | Users can view a list of their saved evaluation sessions and open a detailed view of any session. |
| FR-EW-09 | Delete Saved Evaluation Sessions | Medium | Existing | Users can delete their saved evaluation sessions. |
| FR-EW-10 | Export Evaluation Results | Medium | Future | Allow users to export evaluation results (including source, outputs, scores, comments) to a standard file format (e.g., CSV, Excel). |
| FR-EW-11 | Enhanced UI for Prompt Version Comparison (Diff Highlighting) | Medium | Future | In the evaluation panel or prompt editor, provide a visual diff view to highlight differences between selected prompt versions. |
| FR-EW-12 | AI Model Selection for Evaluation | Medium | Future | Allow users to select from a list of available AI models/versions for running evaluations (if the backend supports more than one or variants of Claude). |
| FR-EW-13 | Refine Results Display & Analysis UI | Medium | Future | Improve the UX of the evaluation results panel for clarity, better display of prompts used for each output, and potentially more advanced filtering/sorting of results. |
| FR-EW-14 | Refine Saved Evaluation Session View | Medium | Future | Enhance the detailed view of saved evaluation sessions for more comprehensive review and analysis. |

### **5.5 Housekeeping & Documentation (HD)**

| ID | Requirement | Priority | Status | Notes |
| :---- | :---- | :---- | :---- | :---- |
| FR-HD-01 | Project Housekeeping & Documentation Consolidation | Medium | Future | Perform code cleanup, refactoring for maintainability, and consolidate existing project documentation (README.md, design docs, etc.) into a more coherent and comprehensive knowledge base for developers and potentially users. |

## **6\. Non-Functional Requirements (NFR)**

| ID | Requirement | Description |
| :---- | :---- | :---- |
| NFR-01 | Performance | UI should be responsive. Backend processing of evaluations should be efficient. API response times should be optimized. Database queries should be performant. |
| NFR-02 | Scalability | The system should be able to handle a growing number of users, prompts, prompt versions, test sets, and evaluation results without significant degradation in performance. |
| NFR-03 | Usability | The user interface must be intuitive, easy to learn, and provide clear feedback. The workflow for core tasks should be streamlined. |
| NFR-04 | Security | Robust authentication and authorization mechanisms. Protection against common web vulnerabilities. Secure handling of API keys and sensitive data. |
| NFR-05 | Maintainability | Codebase should be well-structured, commented, and easy to understand and modify. Modular design to facilitate updates and bug fixes. |
| NFR-06 | Reliability | The application should be stable and consistently available. Background tasks for evaluations should be robust and handle errors gracefully. |
| NFR-07 | Testability | The application should be designed to facilitate unit, integration, and end-to-end testing. (Future: Implement comprehensive test suites). |
| NFR-08 | Configurability | Key parameters (e.g., default LLM judge model, API endpoints for external services) should be configurable. |

## **7\. Future Considerations / Roadmap Items**

This section outlines features and improvements planned or considered for future iterations, based on the "TODO / Next Steps" in the README.md and general product evolution.

* **Enhanced Prompt Versioning UI**:  
  * Visual diffing between prompt versions.  
  * Clearer history navigation within the Prompt Editor.  
* **Advanced Prompt Features**:  
  * Prompt branching for experimental development.  
  * Improved handling and validation of XML-like tags within the prompt editor.  
* **UI/UX Refinements**:  
  * More granular and contextual loading indicators.  
  * Improved error display and handling.  
  * Debouncing for text inputs that trigger API calls (e.g., evaluation result comments).  
  * Resolution of any frontend hydration errors.  
* **Comprehensive Testing Strategy**:  
  * Implementation of unit tests for backend and frontend.  
  * Development of integration tests for key workflows.  
* **Style Guide Integration**:  
  * Allow users to define or link to style guides.  
  * Potentially use style guide information to enrich prompts or automatically check LLM outputs for adherence. (Detailed feature doc to be created separately).  
* **LMS API Integration**:  
  * If required by the business, integrate with an external Localization Management System (LMS) to fetch TM/TB matches for prompt enrichment, as detailed in LMS\_API\_Integration\_Requirements.md.  
* **Expanded AI Model Support**:  
  * Allow selection from a wider range of AI models or versions for evaluation, beyond the current Claude integration.  
* **Advanced Evaluation Metrics**:  
  * Integration of automated metrics like BLEU, COMET, etc., in addition to LLM-as-Judge.  
* **Collaboration Features**:  
  * Sharing prompts or evaluation sessions with other users or teams.  
  * Commenting or discussion threads on prompts/evaluations.  
* **User Onboarding and Documentation**:  
  * In-app tours or tutorials for new users.  
  * Comprehensive user documentation.

## **8\. Out of Scope (For Version 2.0, unless re-prioritized)**

* Real-time collaborative editing of prompts.  
* Full A/B testing framework for prompts.  
* Direct integration for managing TM/TB content within PromptCraft (focus is on *using* existing TM/TB via LMS or similar).