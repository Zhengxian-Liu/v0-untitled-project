import anthropic
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize the Anthropic client once
# Handle potential errors during initialization
try:
    client = anthropic.Anthropic(
        # Defaults to os.environ.get("ANTHROPIC_API_KEY")
        api_key=settings.anthropic_api_key,
    )
except Exception as e:
    logger.error(f"Failed to initialize Anthropic client: {e}")
    client = None # Set client to None if initialization fails

async def generate_text_with_claude(
    prompt_text: str,
    source_text: str,
    model_name: str = "claude-3-opus-20240229", # Or other suitable model
    max_tokens: int = 1024,
) -> str:
    """
    Generates text using the specified Claude model.

    Args:
        prompt_text: The system prompt or instructions.
        source_text: The user input text to be processed.
        model_name: The name of the Claude model to use.
        max_tokens: The maximum number of tokens to generate.

    Returns:
        The generated text content.

    Raises:
        ValueError: If the Anthropic client is not initialized.
        anthropic.APIError: If the API call fails.
    """
    if client is None:
        logger.error("Anthropic client is not initialized. Cannot make API call.")
        # Depending on policy, could raise specific internal error
        raise ValueError("Anthropic client failed to initialize.")

    logger.debug(f"Calling Claude model '{model_name}' with source text: '{source_text[:50]}...'")
    try:
        # Note: Anthropic SDK is synchronous by default.
        # For high throughput, consider httpx for async calls or running sync calls in a thread pool.
        # For this MVP, a direct synchronous call might be acceptable.
        message = client.messages.create(
            model=model_name,
            max_tokens=max_tokens,
            system=prompt_text, # System prompt sets the context/instructions
            messages=[
                {
                    "role": "user",
                    "content": source_text
                }
            ]
        )
        # Assuming the response structure gives content in a list
        if message.content and isinstance(message.content, list):
            # Find the first text block
            text_block = next((block.text for block in message.content if hasattr(block, 'text')), None)
            if text_block:
                logger.debug(f"Claude model returned: '{text_block[:50]}...'")
                return text_block
            else:
                 logger.warning("Claude API returned message content but no text block found.")
                 return "" # Or raise an error
        else:
            logger.warning(f"Claude API returned unexpected response structure: {message}")
            return "" # Or raise an error

    except anthropic.APIError as e:
        logger.error(f"Anthropic API call failed: {e}")
        raise # Re-raise the exception to be handled by the caller (API route)
    except Exception as e:
        # Catch other potential exceptions during the call
        logger.error(f"An unexpected error occurred during Claude API call: {e}")
        raise anthropic.APIError(f"Unexpected error: {e}") # Wrap as APIError for consistent handling

# --- Placeholder for Abstract Base Service (Future Enhancement) ---
# from abc import ABC, abstractmethod
#
# class LanguageModelService(ABC):
#     @abstractmethod
#     async def generate(self, prompt_text: str, source_text: str) -> str:
#         pass
#
# class ClaudeService(LanguageModelService):
#     async def generate(self, prompt_text: str, source_text: str) -> str:
#         # Current implementation uses sync call, ideally make async or use thread pool
#         return await generate_text_with_claude(prompt_text, source_text)
#
# # You could then inject the appropriate service based on configuration 