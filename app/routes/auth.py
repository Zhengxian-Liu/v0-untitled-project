import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Annotated
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from jose import JWTError, jwt

from app.db.client import get_database
# Import models and security utils later
from app.models.user import User, UserCreate, UserInDB # Use User for response
from app.models.common import PyObjectId
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.token import Token, TokenData
from app.core.config import settings # Need settings for decode

router = APIRouter()
USER_COLLECTION = "users"

logger = logging.getLogger(__name__)

# --- Define OAuth2 Scheme --- M
# Points to the URL where clients send username/password to get a token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") # Relative path to /token endpoint
# --- End Scheme --- M

# --- Helper to fetch user --- M
async def get_user(db: AsyncIOMotorDatabase, username: str) -> UserInDB | None:
    """Fetches user document from DB and validates with UserInDB model."""
    user_doc = await db[USER_COLLECTION].find_one({"username": username})
    if user_doc:
        return UserInDB.model_validate(user_doc)
    return None
# --- End Helper ---

# --- Get Current User Dependency --- M
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> UserInDB:
    """Decodes token, validates, and returns the current active user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        username: str | None = payload.get("sub")
        if username is None:
            logger.warning("Token decoding failed: Subject (username) missing.")
            raise credentials_exception
        # Use TokenData model for validation (optional but good practice)
        token_data = TokenData(username=username)
    except JWTError as e:
        logger.warning(f"Token decoding failed: {e}")
        raise credentials_exception

    user = await get_user(db, username=token_data.username)
    if user is None:
        logger.warning(f"Token validation failed: User '{token_data.username}' not found.")
        raise credentials_exception
    # Check if user is disabled later if needed
    # if user.disabled:
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return user
# --- End Dependency ---

# --- Get Current Active User (Example with disabled check) --- M
async def get_current_active_user(
    current_user: Annotated[UserInDB, Depends(get_current_user)]
) -> UserInDB:
    """Dependency to get the current user and check if they are active."""
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
# --- End Active User --- M

# --- NEW: Get Current User Endpoint --- M
@router.get("/users/me", response_model=User)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Returns the details of the currently authenticated user."""
    # The dependency already fetches and validates the user.
    # We specify response_model=User to exclude sensitive data like hashed_password.
    # FastAPI handles converting the UserInDB returned by the dependency to User.
    return current_user
# --- End Get Current User ---

# --- Registration Endpoint --- M
@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate, # Use UserCreate model for input validation
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Registers a new user."""
    # Check if user already exists
    existing_user = await db[USER_COLLECTION].find_one({"username": user_in.username})
    if existing_user:
        logger.warning(f"Registration attempt failed: Username '{user_in.username}' already exists.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Hash the password
    hashed_password = get_password_hash(user_in.password)

    # Prepare user document for DB
    user_db_data = user_in.model_dump(exclude={"password"}) # Exclude plain password
    user_db_data["hashed_password"] = hashed_password
    user_db_data["created_at"] = datetime.utcnow()
    # Set defaults explicitly or rely on model defaults if defined there
    user_db_data.setdefault("disabled", False)

    # Insert new user
    try:
        insert_result = await db[USER_COLLECTION].insert_one(user_db_data)
        created_id = insert_result.inserted_id
    except Exception as e:
        logger.error(f"Database error during user registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user.",
        )

    # Fetch and return the created user (without hashed password)
    created_user_doc = await db[USER_COLLECTION].find_one({"_id": created_id})
    if not created_user_doc:
         raise HTTPException(status_code=500, detail="Could not retrieve user after creation.")

    # --- FIX: Validate using UserInDB, then create User response model --- M
    try:
        user_in_db = UserInDB.model_validate(created_user_doc)
        # Convert UserInDB to dict, then validate/create User model for response
        # This automatically excludes hashed_password as it's not in User model
        user_response = User.model_validate(user_in_db.model_dump())
        return user_response
    except Exception as e:
        logger.error(f"Failed to validate/create user response model: {e}")
        raise HTTPException(status_code=500, detail="Error processing user data after creation.")
    # --- End FIX ---

# --- End Registration --- M

# --- Login Endpoint --- M
@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Handles user login, returns JWT access token."""
    # 1. Find user by username
    user_doc = await db[USER_COLLECTION].find_one({"username": form_data.username})
    if not user_doc:
        logger.info(f"Login failed: User '{form_data.username}' not found.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}, # Standard header for 401
        )

    # Use UserInDB model to easily access fields including hashed_password
    user = UserInDB.model_validate(user_doc)

    # 2. Check if user is disabled
    if user.disabled:
        logger.info(f"Login failed: User '{form_data.username}' is disabled.")
        raise HTTPException(status_code=400, detail="Inactive user")

    # 3. Verify password
    if not verify_password(form_data.password, user.hashed_password):
        logger.info(f"Login failed: Incorrect password for user '{form_data.username}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Create access token
    # Token expiry can be configured via settings
    access_token = create_access_token(
        data={"sub": user.username} # Use username as subject
        # Optionally add expires_delta=timedelta(minutes=...) here
    )

    # 5. Return the token
    return {"access_token": access_token, "token_type": "bearer"}
# --- End Login --- M

# --- End Placeholder --- 