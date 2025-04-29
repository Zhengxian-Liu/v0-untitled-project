# app/core/prompt_templates.py

# Defines how the LLM should format its final translation output.
FIXED_OUTPUT_REQUIREMENT_TEMPLATE = """
Assistant:\n<translated_text>"""

# Corresponds to TASK_INFO_TEMPLATE in prompt-editor.tsx
# Defines the structure for runtime information passed in the user prompt.
# Placeholders should be unique and clearly named.
TASK_INFO_TEMPLATE = """
<your_task>
    <previous_sentence_context>{PREVIOUS_CONTEXT}</previous_sentence_context>
    <source_text>{SOURCE_TEXT}</source_text>
    <following_sentence_context>{FOLLOWING_CONTEXT}</following_sentence_context>
    <target_language>{TARGET_LANGUAGE}</target_language>
    <terminology>{TERMINOLOGY}</terminology>
    <similar_translations>{SIMILAR_TRANSLATIONS}</similar_translations>
    <additional_instructions>{ADDITIONAL_INSTRUCTIONS}</additional_instructions>
</your_task>"""

# Placeholder for Character Info Template (Future)
CHARACTER_INFO_TEMPLATE = """
<character_description>
    <name_chs>{nameChs}</name_chs>
    <name>{name}</name>
    <gender>{gender}</gender>
    <age>{age}</age>
    <occupation>{occupation}</occupation>
    <faction>{faction}</faction>
    <personality>{personality}</personality>
    <speaking_style>{speakingStyle}</speaking_style>
    <sample_dialogue>{sampleDialogue}</sample_dialogue>
    <writing_style>{writingStyle}</writing_style>
</character_description>""" 