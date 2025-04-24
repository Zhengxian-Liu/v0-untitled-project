import logging
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Load environment variables from a .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database settings
    mongo_url: str

    # External API keys
    anthropic_api_key: str

    # Logging configuration
    log_level: str = "INFO"

    @property
    def logging_level(self) -> int:
        """Converts log level string to logging level integer."""
        return logging.getLevelName(self.log_level.upper())


# Create a single instance of the settings to be imported elsewhere
settings = Settings() 