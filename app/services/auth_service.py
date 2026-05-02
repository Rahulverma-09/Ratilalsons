import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from app.config import settings
from app.database.repositories.user_repository import UserRepository
from app.database.repositories.role_repository import RoleRepository
from app.utils.timezone_utils import get_ist_now, get_ist_timestamp, get_ist_timestamp_for_db
import jwt

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
SALT = getattr(settings, "PASSWORD_SALT", "some_salt_value_here")

def get_password_hash(password: str) -> str:
    """Generate a hashed password using HMAC-SHA256 (JWT used as example). In production: use passlib or bcrypt!"""
    try:
        hashed = jwt.encode({"password": password}, SECRET_KEY, algorithm=ALGORITHM)
        logger.debug("Password hashed successfully")
        return hashed
    except Exception as e:
        logger.error(f"Password hashing error: {str(e)}")
        # Don't return insecure fallback in production
        raise HTTPException(status_code=500, detail="Password hashing failed")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a stored hash"""
    try:
        new_hash = get_password_hash(plain_password)
        logger.debug("Password verification attempted")
        return new_hash == hashed_password
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        return False

class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.role_repo = RoleRepository()
        self.SECRET_KEY = SECRET_KEY
        self.ALGORITHM = ALGORITHM
        self.ACCESS_TOKEN_EXPIRE_MINUTES = ACCESS_TOKEN_EXPIRE_MINUTES
        self.REFRESH_TOKEN_EXPIRE_DAYS = REFRESH_TOKEN_EXPIRE_DAYS

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        try:
            # Method 1: JWT format check
            if hashed_password.count('.') == 2:
                return verify_password(plain_password, hashed_password)
            # Method 2: Insecure test fallback removed for production
            new_hash = get_password_hash(plain_password)
            if new_hash == hashed_password:
                return True
            logger.warning("Password verification failed for user.")
            return False
        except Exception as e:
            logger.error(f"Password verification error: {str(e)}")
            return False

    def get_password_hash(self, password: str) -> str:
        return get_password_hash(password)

    def create_access_token(self, data: dict) -> str:
        """Create access token with expiration."""
        to_encode = data.copy()
        expire = get_ist_now() + timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        try:
            encoded_jwt = jwt.encode(to_encode, self.SECRET_KEY, algorithm=self.ALGORITHM)
            logger.info("Access token created successfully")
            return encoded_jwt
        except Exception as e:
            logger.error(f"Token creation error: {str(e)}")
            raise HTTPException(status_code=500, detail="Error creating access token")

    def create_refresh_token(self, data: dict) -> str:
        """Create refresh token with expiration."""
        to_encode = data.copy()
        expire = get_ist_now() + timedelta(days=self.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire})
        try:
            encoded_jwt = jwt.encode(to_encode, self.SECRET_KEY, algorithm=self.ALGORITHM)
            logger.info("Refresh token created successfully")
            return encoded_jwt
        except Exception as e:
            logger.error(f"Refresh token creation error: {str(e)}")
            raise HTTPException(status_code=500, detail="Error creating refresh token")

    @staticmethod
    def verify_token(token: str) -> dict:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            logger.info("Token verified successfully")
            return payload
        except jwt.ExpiredSignatureError:
            logger.error("Token has expired")
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

    @staticmethod
    async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            logger.info(f"Token received: {token}")
            payload = AuthService.verify_token(token)
            logger.info(f"Decoded JWT payload: {payload}")
            user_identifier = payload.get("sub") or payload.get("user_id") or payload.get("username")
            logger.info(f"User identifier extracted: {user_identifier}")
            if user_identifier is None:
                logger.error("No user identifier found in token")
                raise credentials_exception
            user_repo = UserRepository()
            user = user_repo.get_user_by_id(user_identifier)
            logger.info(f"User fetched by user_id: {user}")
            if user is None:
                user = user_repo.get_user_by_username(user_identifier)
                logger.info(f"User fetched by username: {user}")
            if user is None:
                logger.error(f"User not found with identifier: {user_identifier}")
                raise credentials_exception
            if not user.get("is_active", True):
                raise HTTPException(status_code=401, detail="Inactive user")
            user["token_data"] = payload
            logger.info(f"Authenticated user: {user.get('username')}")
            return user
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            raise credentials_exception

    async def admin_required(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        # In production: uncomment this permission check
        if "admin" not in (current_user.get("roles") or []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        logger.info(f"Admin access granted to user {current_user.get('username')}")
        return current_user

    def register_user(self, username, email, password, full_name, phone=None, department=None, role_ids=None, reporting_user_id=None):
        if self.user_repo.get_user_by_username(username):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
        if self.user_repo.get_user_by_email(email):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        import random
        while True:
            user_id = f"USR-{random.randint(100, 999)}"
            if not self.user_repo.get_user_by_id(user_id):
                break
        hashed_password = self.get_password_hash(password)
        if not role_ids:
            default_role = self.role_repo.get_role_by_name("user")
            role_ids = [default_role["id"]] if default_role else []
        user_dict = {
            "user_id": user_id,
            "username": username,
            "email": email,
            "password": hashed_password,
            "full_name": full_name,
            "phone": phone,
            "department": department,
            "is_active": True,
            "created_at": get_ist_timestamp_for_db(),
            "updated_at": get_ist_timestamp_for_db(),
            "role_ids": role_ids,
            "reporting_user_id": reporting_user_id
        }
        new_user = self.user_repo.create_user(user_dict)
        if not new_user:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")
        roles = self.role_repo.get_roles_by_ids(role_ids)
        role_dicts = [{"id": r.get("id", "unknown"), "name": r.get("name", "unknown")} for r in roles if r]
        if reporting_user_id:
            try:
                from app.services.user_hierarchy_service import UserHierarchyService
                import asyncio
                loop = asyncio.get_event_loop()
                loop.run_until_complete(UserHierarchyService.create_hierarchy(new_user["id"], reporting_user_id))
            except Exception as e:
                logger.warning(f"Failed to create hierarchy: {str(e)}")
        response = {
            "id": str(new_user["id"]),
            "username": new_user["username"],
            "email": new_user["email"],
            "full_name": new_user.get("full_name", ""),
            "phone": new_user.get("phone"),
            "department": new_user.get("department"),
            "roles": role_dicts,
            "is_active": new_user.get("is_active", True),
            "created_at": new_user["created_at"],
            "updated_at": new_user.get("updated_at", new_user["created_at"]),
        }
        logger.info(f"Registration response: {response}")
        return response

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        logger.warning("refresh_token endpoint not yet implemented.")
        raise HTTPException(status_code=501, detail="Not implemented")

    def get_user_info(self, user_id: str) -> Dict[str, Any]:
        # Implementation for /me endpoint and profile fetch
        user = self.user_repo.get_user_by_id(user_id)
        if not user:
            # Fallback: try username (legacy)/id
            user = self.user_repo.get_user_by_username(user_id)
        if not user:
            logger.error(f"User not found in get_user_info: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        return user

    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        user = self.user_repo.get_user_by_id(user_id)
        if not user:
            logger.error(f"User not found with ID: {user_id}")
            raise ValueError("User not found")
        password_field = None
        for field in ["password", "hashed_password", "hashedPassword", "hash_password"]:
            if field in user and user[field]:
                password_field = field
                break
        if not password_field:
            logger.error(f"No password field found for user: {user_id}")
            raise ValueError("User record is missing password field")
        if not self.verify_password(old_password, user[password_field]):
            logger.warning(f"Invalid old password for user: {user_id}")
            raise ValueError("Invalid old password")
        new_password_hash = self.get_password_hash(new_password)
        result = self.user_repo.update_user_by_id(
            user_id, 
            {"password": new_password_hash, "updated_at": get_ist_timestamp_for_db()}
        )
        if not result:
            logger.error(f"Failed to update password for user: {user_id}")
            raise ValueError("Failed to update password")
        logger.info(f"Password successfully changed for user: {user_id}")
        return True
