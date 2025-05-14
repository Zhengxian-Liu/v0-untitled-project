# Plan: XML Prompt Structure and Interactive Editing

## 1. Introduction & Goals

This document outlines the implementation plan for transitioning the prompt structure from Markdown-based sections to a more structured XML-tagged format. This change aims to enhance the robustness of prompt definitions and enable more sophisticated interactions and future capabilities.

**Key Goals:**

*   **Structured Prompt Representation:** Define prompts as a sequence of XML-tagged sections, where each tag represents a specific type of content (e.g., role definition, instructions).
*   **Language-Specific XML Tags:** The actual XML tags in the assembled prompt sent to the LLM will be in the selected workspace language. For languages using non-ASCII characters, these tag names will be transliterated or mapped to ASCII-compatible equivalents. UI display of section titles will remain in the user's preferred language (e.g., Chinese).
*   **Interactive Section Management:** Provide a user interface where sections are represented as distinct "objects" (e.g., "pills") that can be added, reordered (via drag-and-drop), and have their content edited.
*   **Textual Tag Referencing:** Allow users to insert textual references to other sections' tags within the content of a section (e.g., "Refer to the `<Examples>` section for formatting.").
*   **Maintain Markdown Content:** Content within XML tags should still support Markdown formatting.

## 2. Core Data Structures & Definitions

### 2.1. Section Object Definition

**Status: Implemented (Backend Model)**

Each editable section in a prompt will be represented by an object with the following properties:

*   `id`: A unique identifier for the section instance (e.g., UUID, to distinguish from `typeId` if multiple sections of the same type exist). *Backend model `PromptSection.id` updated (defaults to `uuid.uuid4()`).*
*   `typeId`: A string that maps to the `id` field of the predefined section types (e.g., "role", "context", "instructions", "custom" from the existing `sectionTypes` in `prompt-editor.tsx`). *Backend model `PromptSection.typeId` (renamed from `type`).*
*   `name`: The display name for the section type (e.g., "角色定义"). *Backend model `PromptSection.name` confirmed.*
*   `content`: A string containing the actual content of the section. This content can include Markdown formatting and textual XML tag references. *Backend model `PromptSection.content` confirmed.*
*   `order`: An integer determining the section's position in the sequence of sections when assembling the final prompt. *Backend model `PromptSection.order` added.*

**Example (Updated):**

```json
[
  {
    "id": "uuid-1",
    "typeId": "role",
    "name": "角色定义",
    "content": "You are a helpful assistant.",
    "order": 0
  },
  {
    "id": "uuid-2",
    "typeId": "instructions",
    "name": "说明",
    "content": "Refer to <Examples> for how to respond.",
    "order": 1
  },
  {
    "id": "uuid-3",
    "typeId": "examples",
    "name": "示例",
    "content": "Example 1: ...",
    "order": 2
  }
]
```

### 2.2. XML Tag Naming and Language Handling

*   **Editable Sections:**
    *   The UI will continue to display section type names in Chinese (e.g., "角色定义" from `sectionTypes`).
    *   A mapping will be required from `typeId` (e.g., "role") to the actual XML tag name used in the assembled prompt. This mapping must account for the workspace language.
    *   **Tag Name Generation:**
        *   For English workspaces: Convert `typeId` to PascalCase (e.g., "role" -> "Role_Definition", "custom" -> "Custom_Section"). A specific mapping might be needed if simple case conversion is not sufficient or if names differ significantly.
        *   For non-ASCII workspaces (e.g., Chinese): The `typeId` will be mapped to an ASCII-compatible string. For example, "角色定义" (typeId: "role") could become `<role_definition_zh>` or a chosen English equivalent like `<Role_Definition_Localized_Context_CN>`. A clear, consistent convention is needed. The simplest approach is to use the English-equivalent tag name (e.g. "Role_Definition") and potentially add a language attribute if ever needed, but the user specified tags should be in the workspace language, meaning an ASCII representation for non-ASCII. For instance, "角色定义" (`role`) in a Chinese workspace could be `jue_se_ding_yi`.
        *   A lookup mechanism: `(typeId, language) -> tagNameString`.
*   **Non-Editable Template Sections:**
    *   Tags within predefined, non-editable prompt templates (e.g., `<OUTPUT_REQUIREMENTS>`, `<TASK_INFO_TEMPLATE>` from `prompt_templates.py`) will *always* remain in English in the assembled prompt, regardless of the workspace language.

### 2.3. Prompt Storage

**Status: Partially Implemented (Backend Model Description Updated)**

The current method of storing prompt parts (e.g., in a database) will need to be updated. The `Prompt` model in `app/models/prompt.py` currently has a `sections: List[PromptSection]` field and an `text: Optional[str]` field.

*   The `sections` field will store the array of new section objects (as defined in 2.1). *The `PromptSection` model within this list has been updated.*
*   The `text` field (currently "Optional: Assembled text content of the prompt") **should be used to store the fully assembled XML string** generated by the backend logic (see section 3.1). *Description of `PromptBase.text` in the backend model updated to reflect this.* 

This will likely involve changing `PromptSection` in `app/models/prompt.py` to match the new structure or creating a new model for the frontend to use, which then gets translated before saving to the existing `PromptSection` structure if backward compatibility for `PromptSection` fields is strictly needed (though evolving `PromptSection` is cleaner). For this plan, we **have evolved `PromptSection` directly**.

## 3. Backend Implementation

### 3.1. Modifying Prompt Assembly Logic

**Implementation Status:** Not yet implemented – this is the focus of the next development phase (see Phase 2 checklist below).

*   A new or updated backend function will take the ordered list of section objects (matching the definition in 2.1, retrieved from the `Prompt.sections` field) and the current workspace language as input.
*   **Assembly Process:**
    1.  Sort section objects based on their `order` property.
    2.  Iterate through the sorted section objects.
    3.  For each section:
        *   Retrieve its `typeId` and `content`.
        *   Determine the correct XML tag name using the mapping/convention defined in 2.2 based on `typeId` and workspace language.
        *   Construct the XML string: `<Generated_Tag_Name>${section.content}</Generated_Tag_Name>`.
    4.  Concatenate the XML strings for all user-defined sections.
    5.  Integrate non-editable template parts: Prepend or append the content of fixed templates (like `FIXED_OUTPUT_REQUIREMENT_TEMPLATE` from `prompt_templates.py`) using their predefined English XML tags. The relative order of user sections vs. template sections needs to be defined (e.g., fixed templates first, then user sections).
    6.  The final output is a single string comprising all XML-tagged sections. No single root XML element will wrap the entire prompt for now.
    7.  **This assembled XML string must be stored in the `Prompt.text` field** of the prompt document when the prompt is saved/updated.

### 3.2. API Adjustments

*   APIs for creating, updating, and retrieving prompts will need to handle the new structured format (array of section objects).
*   Ensure that when a prompt is fetched, the backend provides the section array and the workspace language is known to the frontend for rendering and tag generation.

## 4. Frontend Implementation: Prompt Editor Overhaul

**Status: Partially Implemented (Code updated, pending UUID type resolution in Docker environment and full testing)**

The `PromptEditor` component will undergo significant changes.

### 4.1. Displaying Sections as "Pill-Shaped Objects"

**Status: Not Yet Implemented**

*   Each section object from the prompt's data model will be rendered as a distinct visual block ("pill").
*   **Visuals:**
    *   Clear boundaries for each pill.
    *   Different background colors for adjacent pills to enhance visual distinction.
    *   The pill should visually indicate its "tagged" nature, perhaps with stylized representations of opening/closing tag parts at its horizontal extremities, sharing the same color cue.
    *   The section title (e.g., "角色定义", from `sectionTypes.name` corresponding to `section.typeId`) should be displayed prominently on the pill, likely at the top.
    *   The `section.content` will be displayed within an editable area inside the pill.

### 4.2. Adding New Section Objects

**Status: Implemented (Code in `components/prompt-editor.tsx` updated)**

*   A UI element (e.g., "+" button, dropdown menu) will allow users to add a new section.
*   Users will select the `typeId` for the new section from a list based on `sectionTypes` (displaying the Chinese names like "角色定义"). *(Existing mechanism for type selection on change; add defaults to custom)*.
*   Upon selection, a new section object (with a unique `id` (e.g., UUID), the chosen `typeId`, the corresponding `name` from `sectionTypes`, initial empty `content`, and appropriate `order` relative to existing sections) is added to the frontend's state representing the prompt structure, and a new pill appears in the editor.
    *   `components/prompt-editor.tsx` updated:
        *   Initial sections state for new prompts now uses the new `PromptSection` structure (UUID for `id`, `typeId`, `order`).
        *   `handleAddSection` function updated to create new sections with the correct structure.
        *   `handleInsertSavedSection` and `handleTemplateSelect` updated.

### 4.3. Editing Section Content

**Status: Largely Unchanged (Existing functionality for content editing)**

*   The content area within each section pill will be editable (e.g., using a `TextArea` or a simple rich-text editor that preserves Markdown).
*   Section tag names (derived from `typeId`) are fixed after creation and are not directly editable by the user through the pill's title. *(Logic for `handleSectionTypeChange` updated to use `typeId`)*.

### 4.4. Reordering Section Objects (Drag and Drop)

**Status: Not Yet Implemented (Existing move up/down buttons can be adapted later)**

*   Implement drag-and-drop functionality for the section pills.
*   Users can drag a pill and drop it between other pills or at the beginning/end of the list.
*   This action updates the `order` property of the affected section objects in the frontend state.

### 4.5. Inserting Textual Tag References into Section Content

**Status: Not Yet Implemented**

*   **4.5.1. "Available Tags" List:**
    *   A dedicated UI panel or area (e.g., a sidebar, or a list appearing below the section editor) will display a list of tag names that can be inserted as references.
    *   **Source of Tags:**
        1.  **Non-Editable Template Tags:** Fixed English tag names from `prompt_templates.py` (e.g., `<OUTPUT_REQUIREMENTS>`, `<TASK_INFO_TEMPLATE>`).
        2.  **User-Created Section Tags:** Dynamically generated based on the current set of top-level editable sections in the prompt. The tag name displayed and inserted will be the one appropriate for the current workspace language (e.g., `<Role_Definition>` for English, `<jue_se_ding_yi>` for Chinese, as per 2.2).
*   **4.5.2. Drag and Drop Tag References:**
    *   Users can drag a tag name (e.g., `<Examples>`) from the "Available Tags" list.
    *   They can drop this tag name into the content editing area of any section pill.
    *   Upon dropping, the literal string of the tag name (e.g., "`<Examples>`") is inserted as plain text into the section's content at the cursor position or selection.
    *   **Visual Feedback:** A transparent representation of the tag name should follow the cursor during drag. If dropped in an invalid location (outside a content editor), the drag action is cancelled, and the icon returns.

### 4.6. Handling Empty Sections

*   An empty section (content is an empty string) is permissible.
*   In the editor, it will appear as a normal section pill with an empty content area.
*   In the assembled prompt preview, it could be represented as `(<TagName>)(</TagName>)` if desired for emphasis, or simply `<TagName></TagName>`.

### 4.7. State Management (Frontend)

**Status: Updated (State now uses new `PromptSection` type)**

*   The frontend will maintain the state of the prompt as an array of section objects. *(The `sections` state in `prompt-editor.tsx` now uses the updated `PromptSection` type from `types.tsx`)*.
*   All operations (add, edit content, reorder, delete section) will update this state, which will then re-render the UI. *(Add, edit type logic updated)*.

## 5. UI for Assembled Prompt Preview

*   The existing prompt preview pane will be updated to display the fully assembled prompt string generated by the backend logic (or a frontend simulation of it).
*   This preview should correctly show the XML structure, including the language-specific tags and Markdown rendering within the content of these tags.

## 6. Future Considerations (To-Do)

*   **XML Tag Attributes:** Explore adding support for attributes on XML tags in the future (e.g., `<Instruction severity="high">`).
*   **Schema/DTD:** For very complex prompts, defining a schema (XSD) or DTD might become beneficial.
*   **True Nesting of Section Objects:** The current plan only supports textual referencing. Future iterations could explore allowing actual structural nesting of section objects (pills within pills), which would require significant changes to data structures and rendering logic.
*   **Standardized ASCII Representations for Tags:** Formalize the convention for generating ASCII tag names for non-ASCII workspace languages to ensure consistency and avoid collisions.
*   **Deleting Sections:** A mechanism to delete section pills will be necessary.
*   **Unique ID Generation:** Define strategy for client-side `id` generation for new sections (e.g. `uuidv4`).
*   **Clarify `Prompt.text` field's definitive role:** Confirm that the `Prompt.text` field will store the final assembled XML string. Update any backend logic or descriptions that might imply it stores a non-XML plain text assembly. Determine if a separate plain text version (without XML) is still needed, and if so, how it would be generated and stored/used.

This plan provides a phased approach to implementing the XML-based prompt structure and editing features. Each major numbered section can be considered a significant development stage.

## Phase 2 – Backend XML Assembler (Upcoming)

The goal of Phase 2 is to implement the server-side code that converts the structured `sections` list into the final XML system prompt and stores it in `Prompt.text`.

### P-2 Checklist
1. **Create helper module** `app/core/prompt_assembler.py`
   * `assemble_prompt(sections: list[PromptSection], language: str) -> str`
   * Responsibilities:
     * Sort sections by `order` (fallback to list index if `order` missing).
     * Map each `typeId` → workspace-language XML tag (see 2.2 rules).
     * Wrap content in the generated tag.
     * Prepend / append fixed templates (`FIXED_OUTPUT_REQUIREMENT_TEMPLATE`, `TASK_INFO_TEMPLATE`, etc.).
   * Return the concatenated XML string (no root wrapper for now).
2. **Integrate into API endpoints** in `app/routes/prompts.py`:
   * `create_prompt` (POST /prompts/)
   * `save_new_version_from_existing` (PUT /prompts/{id})
   * Before DB insert/update: `prompt_dict["text"] = assemble_prompt(prompt_dict["sections"], prompt_dict["language"])`
3. **Testing breakpoint**
   * Create a prompt via the UI → verify in MongoDB or via GET /prompts/{id} that the `text` field contains the expected XML.
4. **Edge cases**
   * Missing `order` → derive from list index.
   * Unknown `typeId` → wrap in `<Custom_Section>`.
   * Empty `content` → still emit opening/closing tags.

## 7.  Progress Summary (as of this commit)

| Area | Status |
|------|--------|
| Data models (`PromptSection`, `Prompt`, `types.tsx`) | **Done** |
| Front-end: create/edit section objects in new shape | **Done** (basic; pills UI pending) |
| Front-end: save API payload in new shape | **Done** |
| Back-end: XML assembly & storage | **Pending (Phase 2)** |
| Front-end: pill display, drag-drop reorder, tag reference insertion | **Pending (Phase 3+)** |

Next work item: implement Phase 2 checklist above. 