from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.database.repositories.token_blacklist import TokenBlacklistRepository
from app.database.repositories.user_repository import UserRepository
from app.models.auth import TokenData, UserInfo
import logging
import os
from dotenv import load_dotenv
load_dotenv()

SECRET_KEY = str(os.getenv("SECRET_KEY", "default_secret"))
ALGORITHM = os.getenv("ALGORITHM")

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth-sync/login")

def verify_token(token: str):
    """Verify a JWT token and check if it's blacklisted."""
    try:
        token_blacklist_repo = TokenBlacklistRepository()
        if token_blacklist_repo.is_blacklisted(token):
            logger.warning(f"Token is blacklisted: {token[:10]}...")
            raise JWTError("Token has been revoked")
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            ALGORITHM,
            options={"verify_signature": True}
        )
        logger.info(f"Token verified successfully for user ID: {payload.get('sub')}")
        return payload
    except JWTError as e:
        logger.warning(f"JWT verification error: {e}")
        raise
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        raise

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInfo:
    """Get the current user from a JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = verify_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.warning("Token missing 'sub' claim")
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
        logger.debug(f"Token data extracted: user_id={user_id}")
    except JWTError:
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {str(e)}",
        )

    try:
        from app.database import db
        # Check if users collection exists—if not, fail securely
        if "users" not in db.list_collection_names():
            logger.error("'users' collection not found in database")
            raise credentials_exception

        user = None
        for id_field in ["id", "_id", "user_id", "userId"]:
            user = db["users"].find_one({id_field: token_data.user_id})
            if user:
                break

        if user is None:
            logger.error(f"User with ID {token_data.user_id} not found in database using any ID field")
            raise credentials_exception

        logger.info(f"User found: {user.get('username')}, roles: {user.get('roles', [])}")
    except Exception as e:
        logger.error(f"Database error during authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during authentication"
        )

    # Convert MongoDB ObjectId to string if present
    user_id = str(user.get("_id", "")) if user.get("_id") else user.get("user_id", "")

    # Handle roles properly - ensure it's always a list
    roles = user.get("roles", [])
    if isinstance(roles, str):
        roles = [roles]
    elif not roles:
        roles = [user.get("role", "user")]

    # Create UserInfo with optional fields and fallbacks
    user_info = UserInfo(
        id=user_id,
        username=user.get("username", ""),
        email=user.get("email", ""),
        full_name=user.get("name", "") or user.get("full_name", ""),
        roles=roles,
        reporting_user_id=user.get("reporting_user_id", None)
    )

    return user_info

async def get_current_active_user(current_user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """Check if the current user is active."""
    try:
        user_repo = UserRepository()
        user = await user_repo.get_user_by_id(current_user.id)

        if user is None:
            logger.warning(f"User with ID {current_user.id} not found during active check")
            raise HTTPException(status_code=401, detail="User not found")

        if not user.get("is_active", True):
            logger.warning(f"User with ID {current_user.id} is inactive")
            raise HTTPException(status_code=400, detail="Inactive user")

        logger.info(f"User with ID {current_user.id} is active")
        return current_user
    except Exception as e:
        logger.error(f"Error checking if user is active: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking if user is active"
        )
