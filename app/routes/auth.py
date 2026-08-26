from fastapi import APIRouter, Depends, HTTPException, status, Body, Request, Header, Query, Form
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.database.repositories.token_blacklist import TokenBlacklistRepository
from app.database.schemas.role_schema import RoleResponse, RoleCreate, RoleUpdate
from app.database.repositories.role_repository import RoleRepository
from app.database.repositories.user_repository import UserRepository
import jwt
from jwt import PyJWTError as JWTError
from app.database.schemas.user_schema import (
    UserCreate, UserUpdate, UserResponse,
    PasswordChange, PasswordReset, RefreshTokenRequest
)
from app.models.auth import TokenResponse
from app.services.auth_service import AuthService
import logging
from app.config import settings  


# ---------- SETUP & ENVIRONMENT ----------
logging.basicConfig(level=logging.INFO)
ADMIN_USERNAME = settings.ADMIN_USERNAME
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

auth_router = APIRouter(prefix="/api/auth", tags=["authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

try:
    auth_service = AuthService()
except Exception as e:
    logging.warning(f"Failed to initialize AuthService: {str(e)}")
    from app.services.auth_service import AuthService
    auth_service = AuthService.__new__(AuthService)

def normalize_roles(roles):
    if not roles:
        return []
    if isinstance(roles, str):
        return [roles]
    if isinstance(roles, list):
        result = []
        for r in roles:
            if isinstance(r, dict) and "name" in r:
                result.append(r["name"])
            else:
                result.append(r)
        return result
    return []

def validate_role_ids(role_ids):
    from app.database import roles_collection
    valid_role_ids = set(r['id'] for r in roles_collection.find({}, {'id': 1}))
    for rid in role_ids:
        if rid not in valid_role_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Role ID '{rid}' does not exist in the roles collection"
            )

def role_ids_to_names(role_ids):
    if not role_ids:
        return []
    
    # Check if we have custom role IDs (like 'Ro-023') or ObjectIds
    if all(isinstance(r, str) for r in role_ids):
        # Try to resolve role IDs to names
        role_repo = RoleRepository()
        roles = role_repo.get_roles_by_ids(role_ids)
        names = [r["name"] for r in roles if r and "name" in r]
        if names:  # If we successfully resolved names, return them
            return names
    
    # Fallback to normalize_roles for backward compatibility
    return normalize_roles(role_ids)

def create_jwt_token(data: dict, expire_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=int(expire_minutes))
    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.utcnow(),
            "iss": "your-api"
        }
    )
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_jwt_refresh_token(data: dict, expire_days: int = REFRESH_TOKEN_EXPIRE_DAYS):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=int(expire_days))
    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.utcnow(),
            "iss": "your-api"
        }
    )
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_exception
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "iat"]})
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
        user_repo = UserRepository()
        user = user_repo.get_user_by_id(user_id)
        if not user:
            raise credentials_exception
        role_ids = user.get("role_ids", []) or user.get("roles", [])
        role_names = role_ids_to_names(role_ids)
        return {
            "id": user.get("id") or user.get("user_id"),
            "user_id": user.get("user_id"),
            "username": user.get("username"),
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "roles": role_names,
            "is_active": user.get("is_active", True),
        }
    except JWTError as ex:
        logging.warning(f"JWT error: {ex}")
        raise credentials_exception

async def admin_required(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if "admin" not in normalize_roles(current_user.get("roles", [])):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    return current_user

async def can_manage_users(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    roles = normalize_roles(current_user.get("roles", []))
    if "admin" not in roles and "user_manager" not in roles and "hr" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to manage users"
        )
    return current_user

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not current_user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
    return current_user

@auth_router.post("/register", response_model=UserResponse)
async def register_user(request: Request):
    try:
        content_type = request.headers.get("content-type", "")
        if "application/x-www-form-urlencoded" in content_type:
            form_data = await request.form()
            role_ids = form_data.get("role_ids", [])
            if isinstance(role_ids, str):
                role_ids = [role_ids]
            # --- VALIDATE ROLE IDS ---
            validate_role_ids(role_ids)
            user_data = UserCreate(
                username=form_data.get("username"),
                email=form_data.get("email"),
                full_name=form_data.get("fullname", form_data.get("full_name")),
                password=form_data.get("password"),
                phone=form_data.get("phone"),
                department=form_data.get("department"),
                role_ids=role_ids
            )
        else:
            json_data = await request.json()
            role_ids = json_data.get("role_ids", [])
            if isinstance(role_ids, str):
                role_ids = [role_ids]
            # --- VALIDATE ROLE IDS ---
            validate_role_ids(role_ids)
            json_data["role_ids"] = role_ids
            user_data = UserCreate(**json_data)
        auth_service = AuthService()
        result = auth_service.register_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            phone=user_data.phone,
            department=user_data.department,
            role_ids=role_ids,
            reporting_user_id=None
        )
        if hasattr(result, "roles") or hasattr(result, "role_ids"):
            result.roles = normalize_roles(getattr(result, "roles", None) or getattr(result, "role_ids", None))
        logging.info(f"Registration success: {user_data.username}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Registration failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during registration: {str(e)}"
        )


@auth_router.post("/register-form", response_model=UserResponse)
async def register_user_form(
    username: str = Form(...),
    email: str = Form(...),
    fullname: str = Form(...),
    password: str = Form(...),
    phone: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    role_ids: Optional[List[str]] = Form([])
):
    try:
        if isinstance(role_ids, str):
            role_ids = [role_ids]
        # --- VALIDATE ROLE IDS ---
        validate_role_ids(role_ids)
        user_data = UserCreate(
            username=username,
            email=email,
            full_name=fullname,
            password=password,
            phone=phone,
            department=department,
            role_ids=role_ids
        )
        auth_service = AuthService()
        result = auth_service.register_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            phone=user_data.phone,
            department=user_data.department,
            role_ids=user_data.role_ids,
            reporting_user_id=None
        )
        if hasattr(result, "roles") or hasattr(result, "role_ids"):
            result.roles = normalize_roles(getattr(result, "roles", None) or getattr(result, "role_ids", None))
        logging.info(f"Form registration success: {username}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Registration failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during form registration: {str(e)}"
        )

@auth_router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        auth_service = AuthService()
        user_repo = UserRepository()
        user = user_repo.get_user_by_username(form_data.username)
        if not user:
            user = user_repo.get_user_by_email(form_data.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        password_field = None
        for field in ["hashed_password", "password", "hashedPassword", "hash_password"]:
            if field in user and user[field]:
                password_field = field
                break
        if not password_field:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User record is missing password field"
            )
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user account",
                headers={"WWW-Authenticate": "Bearer"},
            )
        password_verified = auth_service.verify_password(form_data.password, user[password_field])
        if not password_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_data = {
            "sub": user.get("user_id", user["id"]),
            "username": user["username"]
        }
        role_ids = user.get("role_ids", []) or user.get("roles", [])
        role_names = role_ids_to_names(role_ids)
        token_data["roles"] = role_names
        access_token = create_jwt_token(token_data)
        refresh_token = create_jwt_refresh_token(token_data)
        user_response = {
            "id": user.get("user_id", user["id"]),
            "user_id": user.get("user_id", user["id"]),
            "username": user["username"],
        }
        for field in ["email", "full_name", "name", "phone", "department"]:
            if field in user:
                user_response[field] = user[field]
        user_response["roles"] = role_names
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user_response
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Login failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during login: {str(e)}"
        )

@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_data: RefreshTokenRequest):
    try:
        refresh_token = refresh_data.refresh_token
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "iat"]})
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        user_repo = UserRepository()
        user = user_repo.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found")
        token_data = {
            "sub": user["id"],
            "username": user["username"]
        }
        role_ids = user.get("role_ids", []) or user.get("roles", [])
        role_names = role_ids_to_names(role_ids)
        token_data["roles"] = role_names
        access_token = create_jwt_token(token_data)
        new_refresh_token = create_jwt_refresh_token(token_data)
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user.get("email", ""),
                "roles": role_names
            }
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    except Exception as e:
        logging.error(f"Refresh token error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error refreshing token"
        )

@auth_router.get("/me", response_model=Dict[str, Any])
async def get_user_profile(current_user: Dict[str, Any] = Depends(get_current_active_user)):
    try:
        user_info = auth_service.get_user_info(current_user["id"])
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        user_info["roles"] = role_ids_to_names(user_info.get("role_ids", []) or user_info.get("roles", []))
        return user_info
    except Exception as e:
        logging.error(f"Error getting user info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting user info: {str(e)}"
        )

@auth_router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: PasswordChange,
    current_user: Dict[str, Any] = Depends(get_current_active_user)
):
    try:
        result = auth_service.change_password(
            current_user["id"],
            password_data.old_password,
            password_data.new_password
        )
        return {"message": "Password changed successfully", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logging.error(f"Password change failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password change failed: {str(e)}"
        )

@auth_router.post("/request-password-reset", status_code=status.HTTP_200_OK)
async def request_password_reset(email_data: PasswordReset):
    return {"message": "If the email exists, a password reset link will be sent"}

@auth_router.post("/reset-password/{reset_token}", status_code=status.HTTP_200_OK)
async def reset_password(reset_token: str, new_password: str = Body(..., embed=True)):
    return {"message": "Password has been reset successfully"}

@auth_router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(authorization: Optional[str] = Header(None)):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    logging.info(f"Logout request received")
    if not authorization:
        return {"message": "Already logged out", "timestamp": timestamp}
    try:
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        user_id = "unknown"
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub", "unknown")
        except Exception:
            pass
        logging.info(f"Processing logout for user ID: {user_id}")
        token_blacklist_repo = TokenBlacklistRepository()
        token_blacklist_repo.add_to_blacklist(
            token=token,
            user_id=user_id,
            expires_at=None,
            blacklisted_at=datetime.now()
        )
        logging.info(f"Successfully logged out user ID: {user_id}")
        return {
            "message": "Successfully logged out",
            "timestamp": timestamp,
            "user_id": user_id
        }
    except Exception as e:
        logging.error(f"Logout failed: {str(e)}")
        return {
            "message": "Client logout successful, but server session may remain active",
            "timestamp": timestamp,
            "error": str(e)
        }

def map_roles(roles):
    if not roles:
        return []
    if isinstance(roles, str):
        roles = [roles]
    result = []
    for r in roles:
        if isinstance(r, dict):
            result.append(r)
        else:
            result.append({"id": r, "name": r})
    return result

@auth_router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0, 
    limit: int = 100,
    authorization: Optional[str] = Header(None)
):
    try:
        user_repo = UserRepository()
        users = user_repo.list_users(skip, limit)
        sanitized = []
        for user in users:
            mongo_id = str(user.get("_id") or user.get("id") or user.get("userid") or "")
            user["_id"] = mongo_id
            user["id"] = mongo_id
            if "roles" in user:
                user["roles"] = map_roles(user["roles"])
            else:
                user["roles"] = []
            if "full_name" not in user or not user["full_name"]:
                user["full_name"] = user.get("username", "")
            if not user.get("email"):
                user["email"] = None
            for dt_field in ("created_at", "updated_at"):
                val = user.get(dt_field)
                if val and isinstance(val, str):
                    try:
                        user[dt_field] = datetime.fromisoformat(val)
                    except Exception:
                        user[dt_field] = datetime.now()
            sanitized.append(user)
        return sanitized
    except Exception as e:
        logging.error(f"Error listing users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing users: {str(e)}"
        )

from app.database.schemas.user_schema import user_entity
from app.database import roles_collection, users_collection 

@auth_router.get("/users/{username}")
def get_user(username: str):
    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_entity(user, roles_collection)

@auth_router.get("/users/{user_id}", response_model=Dict[str, Any])
async def get_user(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    try:
        user_info = auth_service.get_user_info(user_id)
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user_info
    except Exception as e:
        logging.error(f"Error retrieving user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user: {str(e)}"
        )

@auth_router.put("/users/{user_id}", response_model=Dict[str, Any])
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    authorization: Optional[str] = Header(None)
):
    try:
        user_repo = UserRepository()
        auth_service = AuthService()
        update_data = user_data.dict(exclude_unset=True)
        if "role_ids" in update_data:
            # --- VALIDATE ROLE IDS ON UPDATE ---
            validate_role_ids(update_data["role_ids"])
        if "password" in update_data:
            update_data["password"] = auth_service.get_password_hash(update_data["password"])
        update_data["updated_at"] = datetime.now()
        reporting_user_id = update_data.get('reporting_user_id')
        if reporting_user_id is not None:
            from app.services.user_hierarchy_service import UserHierarchyService
            try:
                try:
                    await UserHierarchyService.get_hierarchy(user_id)
                    await UserHierarchyService.update_hierarchy(user_id, reporting_user_id)
                except ValueError:
                    await UserHierarchyService.create_hierarchy(user_id, reporting_user_id)
            except Exception as e:
                logging.warning(f"Hierarchy update warning: {str(e)}")
        updated = user_repo.update_user(user_id, update_data)
        if updated:
            updated_user = user_repo.get_user_by_id(user_id)
            if updated_user:
                if "password" in updated_user:
                    del updated_user["password"]
                return updated_user
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
        else:
            logging.warning(f"User with ID {user_id} not found in database")
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        logging.error(f"Error updating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user: {str(e)}"
        )

@auth_router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str, 
    current_user: Dict[str, Any] = Depends(admin_required)
):
    try:
        user_repo = UserRepository()
        if user_id == current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )
        if not user_repo.delete_user(user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error deleting user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )

@auth_router.get("/user-info")
async def get_user_info(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "username": current_user.get("username"),
        "email": current_user.get("email"),
        "roles": current_user.get("roles", []),
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

@auth_router.get("/debug/permissions")
async def debug_user_permissions(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to check user permissions"""
    try:
        repo = UserRepository()
        user_with_permissions = repo.get_user_permissions(current_user["id"])
        
        return {
            "user_id": current_user["id"],
            "username": current_user.get("username"),
            "roles": current_user.get("roles", []),
            "permissions": user_with_permissions.get("permissions", []),
            "vendor_permission_exists": "vendor:access" in user_with_permissions.get("permissions", []),
            "total_permissions": len(user_with_permissions.get("permissions", []))
        }
    except Exception as e:
        logging.error(f"Error getting user permissions: {e}")
        return {"error": str(e)}

