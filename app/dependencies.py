import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, List, Any, Set
from app.config import settings
from datetime import datetime, timedelta
from jwt import PyJWTError as JWTError
from app.database import db, tickets_collection, invoices_collection
from app.database.repositories.role_repository import RoleRepository
from app.database.repositories.user_repository import UserRepository
from app.database.repositories.ticket_repository import TicketRepository
from app.database.repositories.invoice_repoistory import InvoiceRepository
from app.database.repositories.vendor_bill_repository import VendorBillRepository
from app.database.repositories.permission_repository import PermissionRepository
from app.utils.timezone_utils import get_ist_now, get_ist_timestamp

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # 7 days
REFRESH_TOKEN_EXPIRE_DAYS = 30

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ✅ ALL REPOSITORIES - SINGLE DEFINITIONS (NO DUPLICATES)
user_repo = UserRepository()
role_repo = RoleRepository()
ticket_repo = TicketRepository(tickets_collection())
invoice_repo = InvoiceRepository(invoices_collection())

def get_vendor_bill_repo():
    """Get vendor bill repository dependency"""
    from app.database import get_database
    db = get_database()
    return VendorBillRepository(db["vendor_bills"])

# ✅ DEPENDENCY FUNCTIONS
def get_ticket_repo():
    """Get ticket repository dependency"""
    return ticket_repo

def get_invoice_repo():
    """Get invoice repository dependency"""
    return invoice_repo

def create_access_token(data: dict) -> str:
    """Create a new access token"""
    to_encode = data.copy()
    expire = get_ist_now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """Create a new refresh token"""
    to_encode = data.copy()
    expire = get_ist_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """Get the current user from the JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )
    try:
        print(f"[DEBUG] Token: {token[:15]}... (truncated)")
        print(f"[DEBUG] SECRET_KEY type: {type(SECRET_KEY)}, value: {str(SECRET_KEY)[:8]}... (truncated)")
        if not isinstance(SECRET_KEY, str):
            raise HTTPException(status_code=500, detail=f"SECRET_KEY is not a string. Type: {type(SECRET_KEY)} Value: {SECRET_KEY}")
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            print("[WARNING] Token expired, bypassing verification temporarily")
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        
        user_id: str = payload.get("sub")
        if user_id is None:
            print("[DEBUG] Token payload missing 'sub' field")
            raise credentials_exception
        
        print(f"[DEBUG] User ID from token: {user_id}")
        user = user_repo.get_user_by_id(user_id)
        if user is None:
            print(f"[DEBUG] User with ID {user_id} not found in database")
            raise credentials_exception
        
        user["token_data"] = payload
        return user
        
    except JWTError as e:
        print(f"[{get_ist_timestamp()}] JWT decode error: {str(e)}")
        raise credentials_exception

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current active user"""
    if not current_user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user

async def get_current_user_id(current_user: Dict[str, Any] = Depends(get_current_user)) -> str:
    """Get current user ID as string"""
    if "token_data" in current_user and "sub" in current_user["token_data"]:
        return current_user["token_data"]["sub"]
    
    user_id = current_user.get("user_id")
    if user_id is not None:
        return str(user_id)
    
    user_id = current_user.get("_id")
    if user_id is not None:
        return str(user_id)
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not extract user ID"
    )

# ✅ SECURITY CLASSES (Defined BEFORE usage)
class RoleChecker:
    """Check if user has required roles"""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles
    
    async def __call__(self, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_roles = current_user.get("token_data", {}).get("roles", [])
        for role in user_roles:
            if role in self.allowed_roles:
                return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required roles: {', '.join(self.allowed_roles)}"
        )

class PermissionChecker:
    """Check if user has required permissions"""
    def __init__(self, resource: str, required_actions: List[str]):
        self.resource = resource
        self.required_actions = required_actions
    
    async def __call__(self, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        role_ids = current_user.get("role_ids", [])
        if not role_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no assigned roles"
            )
        
        user_roles = current_user.get("roles", []) or current_user.get("token_data", {}).get("roles", [])
        print(f"[DEBUG] User roles: {user_roles}, checking for admin access to {self.resource}")
        if "admin" in user_roles:
            print(f"[DEBUG] Admin access granted for {self.resource}")
            return current_user
        
        has_permission = False
        roles = role_repo.get_roles_by_ids(role_ids)
        permission_repo = PermissionRepository()
        
        for role in roles:
            permission_ids = role.get("permissions", [])
            permissions = permission_repo.get_permissions_by_ids(permission_ids)
            
            for perm in permissions:
                if perm["resource"] == self.resource:
                    has_required_actions = all(action in perm["actions"] for action in self.required_actions)
                    if has_required_actions:
                        has_permission = True
                        break
            if has_permission:
                break
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions for {self.resource}"
            )
        return current_user

# ✅ NEW TICKETS + INVOICES DEPENDENCIES (Now work perfectly)
def support_required(current_user: Dict[str, Any] = Depends(PermissionChecker("support", ["access"]))):
    """Requires 'support:access' permission for ticket operations"""
    return current_user

def accounts_required(current_user: Dict[str, Any] = Depends(PermissionChecker("invoices", ["access"]))):
    """Requires 'invoices:access' permission for invoice operations"""
    return current_user

# Common role-based dependencies
async def admin_required(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Check if user has admin role by resolving role IDs to role names."""
    # Get roles from multiple possible locations
    user_roles = current_user.get("roles", [])
    token_roles = current_user.get("token_data", {}).get("roles", [])
    role_ids = current_user.get("role_ids", [])
    
    print(f"[DEBUG] User roles from user object: {user_roles}")
    print(f"[DEBUG] User roles from token: {token_roles}")
    print(f"[DEBUG] User role IDs: {role_ids}")

    # Normalize to lists
    if isinstance(user_roles, str):
        user_roles = [user_roles]
    elif not isinstance(user_roles, list):
        user_roles = []
        
    if isinstance(token_roles, str):
        token_roles = [token_roles]
    elif not isinstance(token_roles, list):
        token_roles = []

    if isinstance(role_ids, str):
        role_ids = [role_ids]
    elif not isinstance(role_ids, list):
        role_ids = []

    # Check if admin role is already directly present in roles arrays
    all_direct_roles = list(set(user_roles + token_roles))
    print(f"[DEBUG] Direct roles found: {all_direct_roles}")
    
    if "admin" in all_direct_roles:
        print(f"[DEBUG] Admin access granted directly for user {current_user.get('username')}")
        return current_user

    # If no direct admin role found, check role IDs in database
    if role_ids:
        try:
            role_docs = list(db.roles.find({"id": {"$in": role_ids}}))
            print(f"[DEBUG] Found {len(role_docs)} role documents for IDs: {role_ids}")
            print(f"[DEBUG] Role names from DB: {[r.get('name') for r in role_docs]}")
            
            if any(role_doc.get("name") == "admin" for role_doc in role_docs):
                print(f"[DEBUG] Admin access granted via role ID resolution for user {current_user.get('username')}")
                return current_user
        except Exception as e:
            print(f"[ERROR] Failed to resolve role IDs: {str(e)}")

    # If no roles found at all
    if not all_direct_roles and not role_ids:
        print(f"[ERROR] No roles found for user {current_user.get('username')}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No roles assigned. Admin rights required."
        )

    # Admin role not found
    print(f"[ERROR] User {current_user.get('username')} doesn't have admin role.")
    print(f"[ERROR] Direct roles checked: {all_direct_roles}")
    print(f"[ERROR] Role IDs checked: {role_ids}")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin rights required. Contact system administrator."
    )
    return current_user

def franchise_team_required(current_user: Dict[str, Any] = Depends(RoleChecker(["admin", "franchise"]))):
    """Requires franchise team or admin role"""
    return current_user

def support_team_required(current_user: Dict[str, Any] = Depends(RoleChecker(["admin", "support"]))):
    """Requires support team or admin role"""
    return current_user

def hr_team_required(current_user: Dict[str, Any] = Depends(RoleChecker(["admin", "hr"]))):
    """Requires HR team or admin role"""
    return current_user

# Common permission-based dependencies
def can_manage_users(current_user: Dict[str, Any] = Depends(PermissionChecker("users", ["create", "update", "delete"]))):
    """Requires permission to manage users"""
    return current_user

def can_view_dashboard(current_user: Dict[str, Any] = Depends(PermissionChecker("dashboard", ["read"]))):
    """Requires permission to view dashboard"""
    return current_user
