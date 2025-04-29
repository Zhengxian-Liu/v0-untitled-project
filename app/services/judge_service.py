import logging
import json
from typing import Optional, Dict, Any

from app.services.claude_service import generate_text_with_claude # Reuse existing Claude service

logger = logging.getLogger(__name__)

# --- Default Judge Configuration --- M
# TODO: Make these configurable later
DEFAULT_JUDGE_MODEL_ID = "claude-3-5-sonnet-20240620" 
# NOTE: System prompt might be handled separately depending on API (e.g., Anthropic)
# Use standard triple-quoted string
DEFAULT_CRITERIA_PROMPT_TEMPLATE = """
 Please evaluate the quality of the provided translation based on accuracy (faithfulness to the source) and fluency (naturalness in the target language). 
 Provide your evaluation *only* in JSON format with the following structure:
 {
   \"score\": <float score between 1.0 and 5.0, where 1 is poor and 5 is excellent>,
   \"rationale\": \"<string, brief justification for the score (1-2 sentences)>\"
 } 
 
 **Source Text:**
 {source_placeholder}
 
 **Translation:**
 {translation_placeholder}
 
 [IF human_reference EXISTS]
 **Reference Translation (for context):**
 {reference_placeholder}
 [END IF]
 
 Evaluation (JSON only):
 """

# --- Judge Result Structure (Conceptual) --- M
# Using a dictionary for now, could be Pydantic model later
JudgeResult = Dict[str, Any]

# --- Core Evaluation Function --- M
async def evaluate_translation(
    source_text: str,
    model_output: str,
    reference_materials: Optional[Dict[str, str]] = None,
    judge_model_id: str = DEFAULT_JUDGE_MODEL_ID, # Use default for now
    criteria_prompt_template: str = DEFAULT_CRITERIA_PROMPT_TEMPLATE
) -> JudgeResult:
    """Evaluates a translation using an LLM judge."""

    formatted_prompt = "" # Initialize

    # --- Input Formatting --- M
    try:
        # Start with the base template
        formatted_prompt = criteria_prompt_template

        # Basic placeholder replacement
        formatted_prompt = formatted_prompt.replace("{source_placeholder}", source_text)
        formatted_prompt = formatted_prompt.replace("{translation_placeholder}", model_output)

        # Conditional inclusion of reference materials
        reference_text = reference_materials.get("human_reference") if reference_materials else None
        if reference_text:
            formatted_prompt = formatted_prompt.replace("{reference_placeholder}", reference_text)
            # Remove the conditional markers if reference exists (more robustly)
            formatted_prompt = formatted_prompt.replace("[IF human_reference EXISTS]\n", "")
            formatted_prompt = formatted_prompt.replace("\n[END IF]", "")
        else:
            # Remove the whole optional block if reference doesn't exist
            start_marker = "[IF human_reference EXISTS]"
            end_marker = "[END IF]"
            start_index = formatted_prompt.find(start_marker)
            end_index = formatted_prompt.find(end_marker)
            # Ensure both markers are found before attempting removal
            if start_index != -1 and end_index != -1 and start_index < end_index:
                block_end_index = end_index + len(end_marker)
                # Check if there's a newline after the block to remove that too
                if block_end_index < len(formatted_prompt) and formatted_prompt[block_end_index] == '\n':
                    block_end_index += 1
                formatted_prompt = formatted_prompt[:start_index].rstrip() + formatted_prompt[block_end_index:].lstrip() # Remove surrounding whitespace too

        # TODO: Add similar conditional logic for other reference_materials keys later

    except Exception as e:
        logger.error(f"Error formatting judge prompt: {e}", exc_info=True)
        return {
            "status": "error",
            "error_message": f"Prompt formatting error: {e}",
            "score": None,
            "rationale": None,
            "raw_judge_output": None,
            "parsed_output": None,
            "judge_model_id": judge_model_id
        }
    # --- End Input Formatting ---

    # --- LLM Call --- M
    raw_output = None
    try:
        logger.debug(f'Sending prompt to Judge LLM ({judge_model_id}):\n{formatted_prompt}')
        # FIX: Pass formatted prompt as user content, use minimal system prompt if needed
        # System prompt could be just basic role setting
        system_prompt = "You are a translation quality evaluator."
        raw_output = await generate_text_with_claude(
            prompt_text=system_prompt, 
            source_text=formatted_prompt, # Main content goes here
            model_id=judge_model_id
        )
        logger.debug(f'Raw response from Judge LLM: {raw_output}')

        if not raw_output:
            raise ValueError("Judge LLM returned empty response.")

    except Exception as e:
        logger.error(f'Error calling Judge LLM ({judge_model_id}): {e}', exc_info=True)
        return {
            "status": "error",
            "error_message": f"LLM API call failed: {e}",
            "score": None,
            "rationale": None,
            "raw_judge_output": raw_output, # Include raw output if available
            "parsed_output": None,
            "judge_model_id": judge_model_id
        }
    # --- End LLM Call ---

    # --- Response Parsing --- M
    parsed_data = None
    score_float = None
    try:
        if not raw_output: # Check again in case it became None somehow
             raise ValueError("Raw output is empty before parsing.")

        # Attempt to parse the response as JSON
        if '```json' in raw_output:
            parts = raw_output.split('```json', 1)
            if len(parts) > 1:
                json_str = parts[1].split('```', 1)[0].strip()
                parsed_data = json.loads(json_str)
            else:
                raise ValueError("Malformed JSON block found in response.")
        elif raw_output.strip().startswith('{') and raw_output.strip().endswith('}'):
            parsed_data = json.loads(raw_output.strip())
        else:
            # Fallback search for JSON object
            try:
                start_index = raw_output.find('{')
                end_index = raw_output.rfind('}')
                if start_index != -1 and end_index != -1 and start_index < end_index:
                    json_str = raw_output[start_index : end_index + 1]
                    parsed_data = json.loads(json_str)
                else:
                    raise ValueError(f"No potential JSON object found in response: {raw_output[:100]}...")
            except json.JSONDecodeError as json_err:
                 raise ValueError(f"Response does not appear to contain valid JSON. Error: {json_err}") from json_err

        # Validate expected keys
        if not isinstance(parsed_data, dict):
             raise ValueError(f"Parsed data is not a dictionary: {type(parsed_data)}")

        score = parsed_data.get("score")
        rationale = parsed_data.get("rationale")

        if score is None or rationale is None:
            logger.warning(f'Parsed JSON missing required keys ("score", "rationale"). Parsed data: {parsed_data}')
            raise ValueError("Parsed JSON missing required keys ('score', 'rationale').")

        # Validate score range/type
        try:
            score_float = float(score)
            if not (1.0 <= score_float <= 5.0):
                logger.warning(f'Judge score {score_float} out of expected range 1-5.')
        except (ValueError, TypeError) as score_err:
             logger.error(f'Invalid score format: "{score}" (Type: {type(score)}). Error: {score_err}')
             raise ValueError(f"Invalid score format: '{score}'. Expected float.") from score_err

        return {
            "status": "success",
            "error_message": None,
            "score": score_float,
            "rationale": str(rationale),
            "raw_judge_output": raw_output,
            "parsed_output": parsed_data,
            "judge_model_id": judge_model_id
        }

    except Exception as e:
        logger.error(f'Error parsing Judge LLM response: {e}', exc_info=True)
        return {
            "status": "error",
            "error_message": f"Response parsing error: {e}",
            "score": None,
            "rationale": None,
            "raw_judge_output": raw_output,
            "parsed_output": parsed_data, # Include parsed if available before error
            "judge_model_id": judge_model_id
        }
    # --- End Response Parsing ---