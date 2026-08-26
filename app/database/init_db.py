from app.database.repositories.role_repository import RoleRepository
from app.database.repositories.user_repository import UserRepository
from app.database.repositories.permission_repository import PermissionRepository
from app.services.auth_service import AuthService

from datetime import datetime
from bson import ObjectId
from pymongo import ReturnDocument
from app.database import db
from dotenv import load_dotenv
load_dotenv() 
import os
import logging

logging.basicConfig(level=logging.INFO)

def get_next_role_id(db):
    """Get next incremental role ID like Ro-001."""
    next_seq = db.counters.find_one_and_update(
        {"_id": "role_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )["seq"]
    return f"Ro-{str(next_seq).zfill(3)}"

def init_roles():
    """Initialize only admin role by default."""
    repo = RoleRepository()
    
    # Create default roles needed for the app (admin, vendor, customer)
    roles = [
        {"name": "admin", "description": "System administrator with specified access permissions", "permissions": []},
        {"name": "vendor", "description": "Vendor with product and sales access", "permissions": []},
        {"name": "customer", "description": "Customer with order and purchase access", "permissions": []},
    ]

    for role_data in roles:
        existing_role = repo.get_role_by_name(role_data["name"])
        if not existing_role:
            new_id = get_next_role_id(db)
            role_data["id"] = new_id
            repo.create_role(role_data)
            logging.info(f"Created role: {role_data['name']} with ID {new_id}")
        else:
            logging.info(f"Role already exists: {role_data['name']}")

# ✅ FIXED: DELETED duplicate default_permissions block (lines 37-51)

def init_permissions():
    permission_repo = PermissionRepository()
    
    modules = [
        {"key": "dashboard", "label": "Dashboard"},
        {"key": "users", "label": "Users List"},
        {"key": "roles", "label": "Roles & Permissions"},
        {"key": "attendance", "label": "Attendance (Checkin/Checkout)"},
        {"key": "customers", "label": "Manage Customers (Admin)"},
        {"key": "vendors", "label": "Manage Vendors (Admin)"},
        {"key": "hr", "label": "Staff Management"},
        {"key": "mark_attendance", "label": "Mark Attendance (HR/Manager)"},
        {"key": "leave", "label": "Leave Management"},
        {"key": "payroll", "label": "Payroll (Salary & Deductions)"},
        {"key": "generator_management", "label": "Equipments & Utility"},
        {"key": "site_management", "label": "Manage Sites"},
        {"key": "inventory", "label": "Inventory (Stock Management)"},
        {"key": "documents", "label": "Documents (Upload & Manage)"},
        {"key": "vendor", "label": "Add Products (Vendor)"},
        {"key": "purchase", "label": "Purchase Products (Customer)"},
        {"key": "sales", "label": "Manage Sales (Vendor)"},
        {"key": "tasks", "label": "Tasks & Workflow (Assign/Track Work)"},
        {"key": "alerts", "label": "Alerts & Notifications"},
        {"key": "reports", "label": "Manage Reports"},
        {"key": "orders", "label": "Track Orders (Customer)"},
        {"key": "support", "label": "Support (Help & Tickets)"},
        {"key": "invoices", "label": "Bills & Invoice"}
    ]
    
    permissions = []
    for mod in modules:
        if mod["key"] == "dashboard":
            permissions.append({
                "code": "dashboard:read",
                "resource": "dashboard",
                "actions": ["read"],
                "name": "Read Dashboard",
                "description": "Read access to dashboard"
            })
            continue
        if mod["key"] == "alerts":
            permissions.append({
                "code": "alerts:read",
                "resource": "alerts",
                "actions": ["read"],
                "name": "Read Alerts",
                "description": "Read access to alerts"
            })
            continue
        if mod["key"] == "reports":
            permissions.append({
                "code": "global_reports:view",
                "resource": "reports",
                "actions": ["view"],
                "name": "View Global Reports",
                "description": "View all reports"
            })
            continue
        # Handle vendors key specifically to map to vendors:access (admin)
        if mod["key"] == "vendors":
            permissions.append({
                "code": "vendors:access",
                "resource": "vendors",
                "actions": ["access"],
                "name": f"Access {mod['label']}",
                "description": f"Access to {mod['label']}"
            })
            continue
        permissions.append({
            "code": f"{mod['key']}:access",
            "resource": mod["key"],
            "actions": ["access"],
            "name": f"Access {mod['label']}",
            "description": f"Access to {mod['label']}"
        })

    for perm_data in permissions:
        existing_permission = permission_repo.get_permission_by_code(perm_data["code"])
        if not existing_permission:
            permission_repo.create_permission(perm_data)
            logging.info(f"Created permission for: {perm_data['resource']} ({perm_data['code']})")
        else:
            logging.info(f"Permission already exists for: {perm_data['resource']} ({perm_data['code']})")

    # ✅ FIXED: Assign permissions to roles AFTER permissions exist
    logging.info("Starting role permission assignment...")
    role_permissions = {
        "admin": [
            "dashboard:read", "users:access", "roles:access", "customers:access",
            "vendors:access", "generator_management:access", "site_management:access",
            "inventory:access", "tasks:access", "payroll:access", "alerts:read",
            "global_reports:view", "support:access", "invoices:access", "documents:access"
        ],
        "hr": [
            "dashboard:read", "attendance:access", "hr:access", "mark_attendance:access",
            "leave:access", "tasks:access", "payroll:access", "documents:access"
        ],
        "manager": [
            "dashboard:read", "attendance:access", "hr:access", "mark_attendance:access",
            "leave:access", "tasks:access", "payroll:access", "documents:access"
        ],
        "employee": [
            "dashboard:read", "attendance:access", "documents:access",
            "leave:access", "tasks:access", "payroll:access"
        ],
        "customer": [
            "dashboard:read", "orders:access", "purchase:access",
            "support:access", "invoices:access"
        ],
        "vendor": [
            "dashboard:read", "vendor:access", "sales:access",
            "support:access", "invoices:access", "documents:access"
        ]
    }

    repo = RoleRepository()  # ✅ Single repo instance
    logging.info("Assigning permissions to roles...")
    for role_name, permissions_list in role_permissions.items():
        role = repo.get_role_by_name(role_name)
        if role:
            repo.update_role(role["id"], {"permissions": permissions_list})
            logging.info(f"Updated permissions for role: {role_name} - Total permissions: {len(permissions_list)}")
            if role_name == "admin":
                logging.info(f"Admin role permissions include vendor:access: {'vendor:access' in permissions_list}")
        else:
            logging.warning(f"Role '{role_name}' not found - skipping permission assignment")
    logging.info("Role permission assignment completed!")

def create_admin_user():
    """Create admin user if it doesn't exist"""
    required_envs = ["ADMIN_USERNAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"]
    missing = [env for env in required_envs if not os.environ.get(env)]
    if missing:
        logging.error(f"Missing env vars: {missing}. Cannot create admin.")
        return
        
    user_repo = UserRepository()
    auth_service = AuthService()
    admin_username = os.environ.get("ADMIN_USERNAME")
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    
    existing_admin = user_repo.get_user_by_username(admin_username)
    if not existing_admin:
        try:
            admin_role = RoleRepository().get_role_by_name("admin")
            admin_role_id = admin_role["id"] if admin_role else None
            if not admin_role_id:
                logging.error("Admin role does not exist -- cannot create admin user.")
                return
            auth_service.register_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                full_name="System Administrator",
                role_ids=[admin_role_id] 
            )
            logging.info(f"Created admin user: {admin_username}")
        except Exception as e:
            logging.error(f"Error creating admin: {e}")
    else:
        logging.info("Admin user already exists")

def init_user_hierarchy_collection():
    logging.info("Setting up user hierarchy collection...")
    user_hierarchy_collection = db["user_hierarchy"]
    user_hierarchy_collection.create_index("user_id", unique=True)
    user_hierarchy_collection.create_index("reporting_user_id")
    user_hierarchy_collection.create_index("level")
    logging.info("User hierarchy collection setup complete!")

def init_gmail_tokens_collection():
    logging.info("Setting up Gmail tokens collection...")
    gmail_tokens_collection = db["gmail_tokens"]
    gmail_tokens_collection.create_index("user_id", unique=True)
    gmail_tokens_collection.create_index("email")
    logging.info("Gmail tokens collection setup complete!")

# ✅ FIXED: Correct initialization order
def initialize_db():
    logging.info("Initializing database...")
    init_roles()                    # 1. Create roles
    init_permissions()              # 2. Create permissions  
    create_admin_user()             # 3. Create admin (needs roles)
    init_user_hierarchy_collection()# 4. Indexes
    init_gmail_tokens_collection()  # 5. Indexes
    logging.info("Database initialization complete!")

if __name__ == "__main__":
    initialize_db()
