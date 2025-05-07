import logging
import os # Import os for generating default secret key
import secrets # Import secrets for secure random generation
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pydantic import Field

# --- Generate a default secret key if not provided --- M
# This helps if someone runs the app without setting it in .env, but prints a warning.
def get_default_secret_key():
    key = secrets.token_hex(32)
    print(f"\n*** WARNING: SECRET_KEY not set in environment. Using temporary key: {key} ***\n")
    print("*** Please generate a strong key and set SECRET_KEY in your .env file for production! ***\n")
    return key
# --- End Default Key ---

class Settings(BaseSettings):
    # Load environment variables from a .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database settings
    mongo_url: str

    # External API keys
    anthropic_api_key: str

    # Logging configuration
    log_level: str = "INFO"

    # --- JWT Settings --- M
    secret_key: str = Field(default_factory=get_default_secret_key)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    # --- End JWT Settings ---

    @property
    def logging_level(self) -> int:
        """Converts log level string to logging level integer."""
        return logging.getLevelName(self.log_level.upper())


# Create a single instance of the settings to be imported elsewhere
settings = Settings() 