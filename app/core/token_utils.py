import logging

try:
    import tiktoken
    # Using a common cl100k_base tokenizer as a general approximation
    # Different models (esp. non-OpenAI) might have different tokenization
    tokenizer = tiktoken.get_encoding("cl100k_base")
    TIKTOKEN_AVAILABLE = True
    logging.info("Tiktoken library loaded successfully.")
except ImportError:
    logging.warning("Tiktoken library not found. Token counts will be estimated using character length.")
    tokenizer = None
    TIKTOKEN_AVAILABLE = False
except Exception as e:
    logging.error(f"Error loading tiktoken tokenizer: {e}", exc_info=True)
    tokenizer = None
    TIKTOKEN_AVAILABLE = False

def estimate_token_count(text: str) -> int:
    """Estimates token count, using tiktoken if available, otherwise approximates."""
    if not text:
        return 0
    if TIKTOKEN_AVAILABLE and tokenizer:
        try:
            return len(tokenizer.encode(text))
        except Exception as e:
            logging.warning(f"Tiktoken encoding failed: {e}. Falling back to character count.")
            # Fallback to character count approximation
            return len(text) // 4 # Rough estimate
    else:
        # Fallback to character count approximation
        return len(text) // 4 # Rough estimate 