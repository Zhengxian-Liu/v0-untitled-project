# Prompt Logic
The prompt will be divided into two parts:
- system prompt
    - translation rules (customizable)
    - output requirement (cannot be changed)
- user prompt
    - character info (to be added later)
    - task info (cannot be changed)
## System Prompt
### Translation rules
Translation rules can be customized by users. It corresponds to the current sections we have (role, instruction, etc). Users can also add or delete sections for translation rules. 
### output requirement
This is where we define what format the model should return. As this needs to be a strict rule, we do not allow users to change it. But we should still show it in the prompt editing and preview section.
## User prompt
### Character info (to be added later)
Later we will have a function to include character info (speaker of the line). The user will first upload or write a test string with both source and extra info. In the extra info will contain speaker information, along with other stuff. We will have a function to extract the speaker name, and use the name to search against a table where we have that character's additional info like tone of voice, age, etc. We then return that info and put them into the character info section. This is a future feature, but we should consider this when updating prompt editor.
Example:
```
<character_description>
        <name_chs>${nameChs}</name_chs>
        <name>${name}</name>
        <gender>${gender}</gender>
        <age>${age}</age>
        <occupation>${occupation}</occupation>
        <faction>${faction}</faction>
        <personality>${personality}</personality>
        <speaking_style>${speakingStyle}</speaking_style>
        <sample_dialogue>${sampleDialogue}</sample_dialogue>
        <writing_style>${writingStyle}</writing_style>
    </character_description>
```

### Task info (cannot be changed)
This section will be automatically populated by system. It mainly include informations that we extract. Cannot be changed, but should be visable. 
Example:
```
<your_task>
    <previous_sentence_context>${aboveText || "N/A"}</previous_sentence_context>  // Context for reference only
    <source_text>${sourceText}</source_text>  // Part to be translated
    <following_sentence_context>${belowText || "N/A"}</following_sentence_context> // Context for reference only
    <target_language>${targetFull}</target_language>
    <terminology>${JSON.stringify(terminology, null, 2)}</terminology> // List of terms to be respected
    <similar_translations>${JSON.stringify(similarTranslations, null, 2)}</similar_translations> // Similar translations with similarity percentages
    <additional_instructions>${observationText || "N/A"}</additional_instructions>  // some additional instructions about this file that can help on translation
  </your_task>

Assistant:
<translated_text>
```
## Requirements
1. We should have a predefined variables. Above are just examples. We should first have a list of variables.
2. Some variables will have the value when editing (like project and language). We should render these variables into language. For those that doesn't have, we can leave them as variables. 
3. we should have a clear indication of the system and user prompt in the editing and preview section.

