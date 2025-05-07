from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Data structure expected inside the JWT payload."""
    username: str | None = None
    # Add other fields like user_id if needed later 